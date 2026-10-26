import { Branch } from '../types';

/** Pengganti aman saat data cabang belum dimuat / belum ada, agar view tidak crash. */
export const EMPTY_BRANCH: Branch = {
  id: '', code: '', name: 'Cabang', tagline: '', address: '', city: '', phone: '', email: '',
  operatingHours: '', status: 'inactive', totalTables: 0, is24Hours: false,
};
