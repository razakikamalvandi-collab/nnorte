'use client';

import { useEffect, useRef } from "react";

type Props = { title?: string };

const vertex = `#version 300 es
in vec2 a_position;
out vec2 v_uv;
void main(){ v_uv=a_position*.5+.5; gl_Position=vec4(a_position,0.,1.); }
`;

const velocityFragment = `#version 300 es
precision highp float;
in vec2 v_uv; out vec4 outColor;
uniform sampler2D u_velocity; uniform vec2 u_pointer; uniform vec2 u_force;
uniform float u_dt; uniform float u_aspect; uniform float u_active; uniform float u_time;
vec2 decode(vec2 x){return (x-.5)*.42;}
void main(){
 vec2 uv=v_uv; vec2 v=decode(texture(u_velocity,uv).rg);
 vec2 back=clamp(uv-v*u_dt,vec2(.001),vec2(.999));
 v=decode(texture(u_velocity,back).rg)*.986;
 vec2 p=uv-u_pointer; p.x*=u_aspect; float d=length(p);
 float reach=exp(-d*d*150.); vec2 radial=normalize(p+vec2(.0001));
 vec2 tangent=vec2(-radial.y,radial.x);
 v += (u_force*1.4 + tangent*(length(u_force)*.8 + .018))*reach*u_active;
 vec2 flow=vec2(sin(uv.y*8.+u_time*.8),cos(uv.x*7.-u_time*.65));
 v += flow*.0018*u_dt*60.;
 v=clamp(v,vec2(-.19),vec2(.19)); outColor=vec4(v/.42+.5,0.,1.);
}`;

const dyeFragment = `#version 300 es
precision highp float;
in vec2 v_uv; out vec4 outColor;
uniform sampler2D u_dye; uniform sampler2D u_velocity;
uniform vec2 u_pointer; uniform vec2 u_force;
uniform float u_dt; uniform float u_aspect; uniform float u_active; uniform float u_time;
vec2 decode(vec2 x){return (x-.5)*.42;}
void main(){
 vec2 uv=v_uv; vec2 vel=decode(texture(u_velocity,uv).rg);
 vec2 back=clamp(uv-vel*u_dt,vec2(.001),vec2(.999));
 vec2 dye=texture(u_dye,back).rg*.997;
 vec2 n=vec2(1.)/vec2(textureSize(u_dye,0));
 dye=(dye*4.+texture(u_dye,back+n*vec2(1,0)).rg+texture(u_dye,back-n*vec2(1,0)).rg+
 texture(u_dye,back+n*vec2(0,1)).rg+texture(u_dye,back-n*vec2(0,1)).rg)*.125;
 vec2 p=uv-u_pointer; p.x*=u_aspect; float d=length(p);
 float spot=exp(-d*d*78.)*u_active;
 float cursorBlue=smoothstep(.18,.82,u_pointer.x);
 dye.r += spot*.22*(1.-cursorBlue); dye.g += spot*.22*cursorBlue;
 float wave=sin(uv.x*7.-uv.y*5.+u_time*.95);
 float left=exp(-pow((uv.x-.24-wave*.025)*3.6,2.)-pow((uv.y-.48)*2.4,2.));
 float right=exp(-pow((uv.x-.76+wave*.025)*3.6,2.)-pow((uv.y-.53)*2.4,2.));
 dye += vec2(left*.0018,right*.0018)*u_dt*60.;
 outColor=vec4(clamp(dye,0.,1.),0.,1.);
}`;

const displayFragment = `#version 300 es
precision highp float;
in vec2 v_uv; out vec4 outColor; uniform sampler2D u_dye;
uniform float u_time; uniform vec2 u_resolution;
void main(){
 vec2 uv=v_uv; vec2 dye=texture(u_dye,uv).rg;
 vec2 dyeGradient=vec2(dFdx(dye.r+dye.g),dFdy(dye.r+dye.g));
 vec2 drift=vec2(sin(uv.y*7.+u_time*1.15),cos(uv.x*6.-u_time*.9))*.085 + dyeGradient*.16;
 vec2 shapeUv=uv+drift;
 float redBase=exp(-pow((shapeUv.x-.18)*4.,2.)-pow((shapeUv.y-.48)*2.25,2.));
 float blueBase=exp(-pow((shapeUv.x-.82)*4.,2.)-pow((shapeUv.y-.53)*2.25,2.));
 dye=max(dye,vec2(redBase,blueBase)*.55);
 float r=dye.r, b=dye.g; float mass=clamp(r+b,0.,1.);
 float blend=b/(r+b+.0001);
 vec3 red=vec3(.95,.035,.095), blue=vec3(.08,.24,1.);
 vec3 col=mix(red,blue,smoothstep(.08,.92,blend));
 float halo=exp(-pow((uv.x-.5)*2.1,2.)-pow((uv.y-.5)*1.45,2.));
 float field=clamp(mass*1.3 + halo*.012,0.,1.);
 float edge=length(vec2(dFdx(mass),dFdy(mass)))*18.;
 float waveLight=sin((uv.x*11.+uv.y*8.)+sin(uv.y*13.+u_time*.8)*1.4-u_time*.65)*.5+.5;
 float shine=pow(clamp(edge,0.,1.),1.6)*.42 + pow(waveLight,20.)*field*.18;
 col=mix(col,vec3(.48,.55,1.),smoothstep(.28,.58,blend)*(1.-smoothstep(.7,.95,blend))*.23);
 col=col*field*(.72+shine)+shine*.35;
 float alpha=clamp(field*.92,0.,.9);
 outColor=vec4(col,alpha);
}`;

function shader(gl: WebGL2RenderingContext, type: number, source: string) {
  const value = gl.createShader(type);
  if (!value) throw new Error('Unable to create WebGL shader');
  gl.shaderSource(value, source);
  gl.compileShader(value);
  if (!gl.getShaderParameter(value, gl.COMPILE_STATUS)) {
    const error = gl.getShaderInfoLog(value);
    gl.deleteShader(value);
    throw new Error(error || 'Shader compile failed');
  }
  return value;
}

function program(gl: WebGL2RenderingContext, fragment: string) {
  const result = gl.createProgram();
  if (!result) throw new Error('Unable to create WebGL program');
  gl.attachShader(result, shader(gl, gl.VERTEX_SHADER, vertex));
  gl.attachShader(result, shader(gl, gl.FRAGMENT_SHADER, fragment));
  gl.linkProgram(result);
  if (!gl.getProgramParameter(result, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(result) || 'Program link failed');
  return result;
}

type Target = { texture: WebGLTexture; framebuffer: WebGLFramebuffer };

function target(gl: WebGL2RenderingContext, width: number, height: number): Target {
  const texture = gl.createTexture();
  const framebuffer = gl.createFramebuffer();
  if (!texture || !framebuffer) throw new Error('Unable to create WebGL target');
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
  if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw new Error('WebGL framebuffer incomplete');
  return { texture, framebuffer };
}

export function FluidPlasmaBackground({ title = 'NNORTE' }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext('webgl2', { alpha: true, antialias: false, powerPreference: 'low-power' });
    if (!gl) return;
    let raf = 0;
    let disposed = false;
    let last = performance.now();
    let time = 0;
    let width = 1;
    let height = 1;
    let simWidth = 1;
    let simHeight = 1;
    let velocityTargets: Target[] = [];
    let dyeTargets: Target[] = [];
    let vi = 0;
    let di = 0;
    let velocityProgram: WebGLProgram;
    let dyeProgram: WebGLProgram;
    let displayProgram: WebGLProgram;
    let pointer = { x: 0.5, y: 0.5 };
    let force = { x: 0, y: 0 };
    let active = 0;
    let pressure = 0;
    let previousPointer: { x: number; y: number; at: number } | null = null;
    const quad = gl.createBuffer();
    if (!quad) return;
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
    try {
      velocityProgram = program(gl, velocityFragment);
      dyeProgram = program(gl, dyeFragment);
      displayProgram = program(gl, displayFragment);
    } catch (error) {
      console.warn('Fluid plasma unavailable:', error);
      return;
    }

    const uniform = (p: WebGLProgram, name: string) => gl.getUniformLocation(p, name);
    const render = (p: WebGLProgram, framebuffer: WebGLFramebuffer | null, w: number, h: number) => {
      gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
      gl.viewport(0, 0, w, h);
      gl.useProgram(p);
      gl.bindBuffer(gl.ARRAY_BUFFER, quad);
      const loc = gl.getAttribLocation(p, 'a_position');
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    };
    const texture = (p: WebGLProgram, name: string, value: WebGLTexture, unit: number) => {
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, value);
      gl.uniform1i(uniform(p, name), unit);
    };
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      width = Math.max(1, Math.floor(window.innerWidth * dpr));
      height = Math.max(1, Math.floor(window.innerHeight * dpr));
      canvas.width = width;
      canvas.height = height;
      const scale = Math.min(0.68, 1050 / Math.max(width, height));
      simWidth = Math.max(2, Math.floor(width * scale));
      simHeight = Math.max(2, Math.floor(height * scale));
      [...velocityTargets, ...dyeTargets].forEach((t) => {
        gl.deleteTexture(t.texture);
        gl.deleteFramebuffer(t.framebuffer);
      });
      velocityTargets = [target(gl, simWidth, simHeight), target(gl, simWidth, simHeight)];
      dyeTargets = [target(gl, simWidth, simHeight), target(gl, simWidth, simHeight)];
      vi = 0;
      di = 0;
      velocityTargets.forEach((t) => {
        gl.bindFramebuffer(gl.FRAMEBUFFER, t.framebuffer);
        gl.clearColor(0.5, 0.5, 0, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);
      });
      dyeTargets.forEach((t) => {
        gl.bindFramebuffer(gl.FRAMEBUFFER, t.framebuffer);
        gl.clearColor(0, 0, 0, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);
      });
    };
    resize();
    window.addEventListener('resize', resize, { passive: true });

    const setPointer = (event: PointerEvent) => {
      const now = performance.now();
      const x = event.clientX / Math.max(1, window.innerWidth);
      const y = 1 - event.clientY / Math.max(1, window.innerHeight);
      if (previousPointer) {
        const dt = Math.max(0.008, Math.min(0.06, (now - previousPointer.at) / 1000));
        force.x = Math.max(-0.8, Math.min(0.8, (x - previousPointer.x) / dt));
        force.y = Math.max(-0.8, Math.min(0.8, (y - previousPointer.y) / dt));
      }
      pointer = { x, y };
      active = Math.min(1, active + 0.65);
      pressure = event.buttons ? 1 : pressure;
      previousPointer = { x, y, at: now };
    };
    const down = (event: PointerEvent) => {
      pressure = 1;
      setPointer(event);
    };
    const up = () => {
      pressure = 0;
    };
    window.addEventListener('pointermove', setPointer, { passive: true });
    window.addEventListener('pointerdown', down, { passive: true });
    window.addEventListener('pointerup', up, { passive: true });
    window.addEventListener('pointercancel', up, { passive: true });
    window.addEventListener('blur', up);

    const frame = (now: number) => {
      if (disposed) return;
      const dt = Math.min(0.032, Math.max(0.001, (now - last) / 1000));
      last = now;
      time += dt;
      active *= Math.exp(-dt * 1.7);
      force.x *= Math.exp(-dt * 3.2);
      force.y *= Math.exp(-dt * 3.2);
      gl.disable(gl.BLEND);
      render(velocityProgram, velocityTargets[1 - vi].framebuffer, simWidth, simHeight);
      texture(velocityProgram, 'u_velocity', velocityTargets[vi].texture, 0);
      gl.uniform2f(uniform(velocityProgram, 'u_pointer'), pointer.x, pointer.y);
      gl.uniform2f(uniform(velocityProgram, 'u_force'), force.x, force.y);
      gl.uniform1f(uniform(velocityProgram, 'u_dt'), dt);
      gl.uniform1f(uniform(velocityProgram, 'u_aspect'), width / height);
      gl.uniform1f(uniform(velocityProgram, 'u_active'), Math.max(active, pressure * 0.75));
      gl.uniform1f(uniform(velocityProgram, 'u_time'), time);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      vi = 1 - vi;
      render(dyeProgram, dyeTargets[1 - di].framebuffer, simWidth, simHeight);
      texture(dyeProgram, 'u_dye', dyeTargets[di].texture, 0);
      texture(dyeProgram, 'u_velocity', velocityTargets[vi].texture, 1);
      gl.uniform2f(uniform(dyeProgram, 'u_pointer'), pointer.x, pointer.y);
      gl.uniform2f(uniform(dyeProgram, 'u_force'), force.x, force.y);
      gl.uniform1f(uniform(dyeProgram, 'u_dt'), dt);
      gl.uniform1f(uniform(dyeProgram, 'u_aspect'), width / height);
      gl.uniform1f(uniform(dyeProgram, 'u_active'), Math.max(active, pressure * 0.75));
      gl.uniform1f(uniform(dyeProgram, 'u_time'), time);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      di = 1 - di;
      render(displayProgram, null, width, height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      texture(displayProgram, 'u_dye', dyeTargets[di].texture, 0);
      gl.uniform1f(uniform(displayProgram, 'u_time'), time);
      gl.uniform2f(uniform(displayProgram, 'u_resolution'), width, height);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      raf = requestAnimationFrame(frame);
    };
    const visibility = () => {
      if (document.hidden) cancelAnimationFrame(raf);
      else {
        last = performance.now();
        raf = requestAnimationFrame(frame);
      }
    };
    document.addEventListener('visibilitychange', visibility);
    raf = requestAnimationFrame(frame);
    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('pointermove', setPointer);
      window.removeEventListener('pointerdown', down);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      window.removeEventListener('blur', up);
      [...velocityTargets, ...dyeTargets].forEach((t) => {
        gl.deleteTexture(t.texture);
        gl.deleteFramebuffer(t.framebuffer);
      });
      gl.deleteProgram(velocityProgram);
      gl.deleteProgram(dyeProgram);
      gl.deleteProgram(displayProgram);
      gl.deleteBuffer(quad);
    };
  }, []);

  return (
    <div aria-hidden="true" className="nnorte-fluid-plasma">
      <canvas ref={canvasRef} className="nnorte-fluid-plasma__canvas" />
      <div className="nnorte-fluid-plasma__title">{title}</div>
    </div>
  );
}
