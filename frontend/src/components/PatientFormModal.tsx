/**
 * 患者新增 / 编辑弹窗 —— 取代原先跳转 /patients/create、/patients/:id/edit 的整页表单。
 * 列表页（PatientList）与详情页（PatientDetail）共用这一个组件：
 *   · 不传 patient = 新增
 *   · 传 patient   = 编辑（直接用已有对象预填，不必再请求一次）
 * 字段与原 PatientForm 完全一致，只是从「整页 Card + 返回箭头」搬进 Modal。
 */
import { useEffect, useState } from "react";
import { Form, Input, Modal, Select, message } from "antd";
import VoiceTextArea from "./VoiceTextArea";
import { createPatient, updatePatient, type PatientInfo } from "../api/patients";

interface Props {
  open: boolean;
  /** 传了就是编辑；不传 / 传 null 是新增 */
  patient?: PatientInfo | null;
  onClose: () => void;
  /** 保存成功后回调（返回后端写回的对象，含 id），弹窗自己负责关闭 */
  onSaved: (p: PatientInfo) => void;
}

export default function PatientFormModal({ open, patient, onClose, onSaved }: Props) {
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);

  // 每次打开时回填 / 清空：不 destroy Modal，避免 useForm 与表单断连的告警
  useEffect(() => {
    if (!open) return;
    if (patient) form.setFieldsValue(patient);
    else form.resetFields();
  }, [open, patient, form]);

  const submit = async () => {
    let values: Record<string, any>;
    try {
      values = await form.validateFields();
    } catch {
      return; // 校验不过：错误提示已在字段上，留在弹窗里改
    }
    setSaving(true);
    try {
      const saved = patient
        ? await updatePatient(patient.id, values)
        : await createPatient(values);
      message.success(patient ? "已保存" : "已创建患者");
      onSaved(saved);
      onClose();
    } catch (e: any) {
      message.error(e?.response?.data?.detail || (patient ? "保存失败" : "创建失败"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={patient ? "编辑患者" : "新增患者"}
      open={open}
      onCancel={onClose}
      onOk={submit}
      confirmLoading={saving}
      okText="保存"
      cancelText="取消"
      width={560}
      maskClosable={false}
    >
      <Form form={form} layout="vertical" initialValues={{ gender: "其他" }}>
        <Form.Item name="name" label="姓名" rules={[{ required: true, message: "请输入姓名" }]}>
          <Input placeholder="患者姓名" />
        </Form.Item>
        <Form.Item name="gender" label="性别">
          <Select options={[{ value: "男" }, { value: "女" }, { value: "其他" }]} />
        </Form.Item>
        <Form.Item name="phone" label="手机号"><Input placeholder="选填" /></Form.Item>
        <Form.Item name="id_card" label="身份证号"><Input placeholder="选填" /></Form.Item>
        <Form.Item name="birth_date" label="出生日期"><Input placeholder="如 1990-01-01" /></Form.Item>
        <Form.Item name="address" label="地址"><Input placeholder="选填" /></Form.Item>
        <Form.Item name="medical_history" label="病史">
          <VoiceTextArea rows={3} />
        </Form.Item>
      </Form>
    </Modal>
  );
}
