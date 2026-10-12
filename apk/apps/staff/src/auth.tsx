/**
 * 员工端鉴权上下文
 */
import React from "react";
import { createAuthContext, createAuthProvider, StaffUser } from "@medicode/shared";

export const StaffAuthContext = createAuthContext<StaffUser>();

export const useStaffAuth = () => {
  const ctx = React.useContext(StaffAuthContext);
  return ctx;
};

const Passthrough: React.FC<React.PropsWithChildren<{}>> = ({ children }) => (
  <>{children}</>
);

export const StaffAuthProvider = createAuthProvider(StaffAuthContext, Passthrough);
