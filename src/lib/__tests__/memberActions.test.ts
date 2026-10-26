import { describe, expect, it } from 'vitest';
import { canDeleteMember } from '../memberActions';
import { UserRole } from '../../types';

const ALL_ROLES: UserRole[] = ['owner', 'branch_admin', 'cashier', 'kitchen', 'customer'];

describe('canDeleteMember', () => {
  it('owner dapat mencabut akses semua staf non-owner', () => {
    expect(canDeleteMember('owner', { role: 'branch_admin', isSelf: false })).toBe(true);
    expect(canDeleteMember('owner', { role: 'cashier', isSelf: false })).toBe(true);
    expect(canDeleteMember('owner', { role: 'kitchen', isSelf: false })).toBe(true);
  });

  it('owner tidak dapat mencabut akses owner', () => {
    expect(canDeleteMember('owner', { role: 'owner', isSelf: false })).toBe(false);
  });

  it('branch_admin hanya dapat mencabut akses kasir/dapur', () => {
    expect(canDeleteMember('branch_admin', { role: 'cashier', isSelf: false })).toBe(true);
    expect(canDeleteMember('branch_admin', { role: 'kitchen', isSelf: false })).toBe(true);
    expect(canDeleteMember('branch_admin', { role: 'branch_admin', isSelf: false })).toBe(false);
    expect(canDeleteMember('branch_admin', { role: 'owner', isSelf: false })).toBe(false);
  });

  it('tidak ada yang dapat mencabut akses dirinya sendiri', () => {
    for (const viewer of ALL_ROLES) {
      for (const role of ALL_ROLES) {
        expect(canDeleteMember(viewer, { role, isSelf: true })).toBe(false);
      }
    }
  });

  it('cashier, kitchen, dan customer tidak dapat mencabut akses siapa pun', () => {
    for (const viewer of ['cashier', 'kitchen', 'customer'] as UserRole[]) {
      for (const role of ALL_ROLES) {
        expect(canDeleteMember(viewer, { role, isSelf: false })).toBe(false);
      }
    }
  });
});
