/**
 * 患者端鉴权上下文
 */
import React from "react";
import { createAuthContext, createAuthProvider, PatientProfile } from "@medicode/shared";

export const PatientAuthContext = createAuthContext<PatientProfile>();

export const usePatientAuth = () => React.useContext(PatientAuthContext);

const Passthrough: React.FC<React.PropsWithChildren<{}>> = ({ children }) => (
  <>{children}</>
);

export const PatientAuthProvider = createAuthProvider(PatientAuthContext, Passthrough);
