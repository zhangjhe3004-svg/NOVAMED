/**
 * 共享类型定义 —— 与后端 Schema 对齐
 */

// 员工用户
export interface StaffUser {
  id: number;
  username: string;
  real_name: string;
  role: string;
  phone?: string;
  email?: string;
  department?: string;
  title?: string;
  employee_no?: string;
  work_status?: string;
  auth_level?: number;
  superior_id?: number | null;
}

// 登录返回
export interface TokenResponse {
  access_token: string;
  expires_in?: number;
  user: StaffUser;
}

// 患者
export interface PatientProfile {
  id: number;
  name: string;
  gender: string;
  phone: string;
  id_card?: string;
  id_type?: string;
  id_number?: string;
  surname?: string;
  given_name?: string;
  address?: string;
  birth_date?: string;
  medical_history?: string;
  registered_place?: string;
  status?: string;
}

// 患者登录返回
export interface PatientTokenResponse {
  access_token: string;
  patient?: PatientProfile;
  profile?: PatientProfile;
}

// 就诊记录
export interface MedicalRecord {
  id: number;
  patient_id?: number;
  patient_name?: string;
  doctor_id?: number;
  doctor_name?: string;
  department?: string;
  symptoms?: string;
  diagnosis?: string;
  prescription?: string;
  note?: string;
  created_at?: string;
  status?: string;
}

// 预约
export interface Appointment {
  id: number;
  patient_id?: number;
  patient_name?: string;
  doctor_id?: number;
  doctor_name?: string;
  department?: string;
  date?: string;
  time_slot?: string;
  status?: string;
  created_at?: string;
}

// 通用分页
export interface Paged<T> {
  items: T[];
  total: number;
}
