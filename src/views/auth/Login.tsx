import React from "react";
import AuthPage from "./original/AuthPage";

interface LoginProps {
  onGoToCustomer: () => void;
}

/**
 * Halaman masuk NNORTE. Tampilan/markup/CSS/animasi memakai login ORIGINAL
 * (lihat ./original). Autentikasi tetap lewat AuthContext + Supabase milik NNORTE
 * (lihat ./original/lib/authAdapter.tsx).
 */
export const Login: React.FC<LoginProps> = ({ onGoToCustomer }) => {
  return <AuthPage onGoToCustomer={onGoToCustomer} />;
};
