import React, { useEffect, useState } from "react";
import QRCode from "qrcode";

interface QRCodeImageProps {
  value: string;
  alt: string;
  className?: string;
  size?: number;
}

export const QRCodeImage: React.FC<QRCodeImageProps> = ({
  value,
  alt,
  className,
  size = 240,
}) => {
  const [dataUrl, setDataUrl] = useState('');

  useEffect(() => {
    let isActive = true;

    QRCode.toDataURL(value, {
      width: size,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: { dark: '#111111', light: '#FFFFFF' },
    }).then((result) => {
      if (isActive) setDataUrl(result);
    });

    return () => {
      isActive = false;
    };
  }, [size, value]);

  if (!dataUrl) {
    return <div className={className} style={{ width: size, height: size }} aria-label="Membuat QR code" />;
  }

  return <img src={dataUrl} alt={alt} width={size} height={size} className={className} />;
};
