import { LockOutlined, MailOutlined, SafetyOutlined } from '@ant-design/icons';
import { Alert, Button, Card, Flex, Form, Input, Spin, Typography } from 'antd';
import { useEffect, useState } from 'react';
import { DvoteLogo } from '../components/DvoteLogo';
import { useAuth, type Enrollment } from '../lib/auth';
import { errorMessage } from '../lib/api';
import { brand } from '../theme';

const { Title, Text, Paragraph } = Typography;

/** Sign-in for platform admins: password, then the authenticator-app code (or its first-time setup). */
export function Login() {
  const { status, notice } = useAuth();
  return (
    <Flex align="center" justify="center" style={{ minHeight: '100vh', padding: 24, background: brand.canvas }}>
      <Flex vertical align="center" gap={28} style={{ width: '100%', maxWidth: 420 }}>
        <Flex vertical align="center" gap={6}>
          <DvoteLogo height={44} color={brand.purple} />
          <Text type="secondary">Admin dashboard</Text>
        </Flex>
        <Card style={{ width: '100%', boxShadow: '0 8px 30px rgba(17,17,20,0.06)' }}>
          {notice ? <Alert type="error" showIcon message={notice} style={{ marginBottom: 20 }} /> : null}
          {status === 'mfaVerify' ? <CodeStep /> : status === 'mfaEnroll' ? <EnrollStep /> : <PasswordStep />}
        </Card>
        <Text type="secondary" style={{ fontSize: 12 }}>
          Only dvote team accounts can sign in here.
        </Text>
      </Flex>
    </Flex>
  );
}

function PasswordStep() {
  const { signIn } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <Title level={3} className="page-title">
        Sign in
      </Title>
      <Paragraph type="secondary" style={{ marginTop: 6 }}>
        Use your dvote admin email and password.
      </Paragraph>
      <Form
        layout="vertical"
        requiredMark={false}
        onFinish={async (v: { email: string; password: string }) => {
          setBusy(true);
          setError(null);
          try {
            await signIn(v.email.trim(), v.password);
          } catch (err) {
            setError(errorMessage(err));
          } finally {
            setBusy(false);
          }
        }}
      >
        <Form.Item name="email" label="Email" rules={[{ required: true, type: 'email', message: 'Enter your email' }]}>
          <Input size="large" prefix={<MailOutlined />} autoComplete="username" autoFocus />
        </Form.Item>
        <Form.Item name="password" label="Password" rules={[{ required: true, message: 'Enter your password' }]}>
          <Input.Password size="large" prefix={<LockOutlined />} autoComplete="current-password" />
        </Form.Item>
        {error ? <Alert type="error" showIcon message={error} style={{ marginBottom: 16 }} /> : null}
        <Button type="primary" htmlType="submit" size="large" block loading={busy}>
          Continue
        </Button>
      </Form>
    </>
  );
}

function CodeInput({ onSubmit, busy }: { onSubmit: (code: string) => void; busy: boolean }) {
  return (
    <Form layout="vertical" requiredMark={false} onFinish={(v: { code: string }) => onSubmit(v.code)}>
      <Form.Item name="code" rules={[{ required: true, pattern: /^\d{6}$/, message: 'Enter the 6-digit code' }]}>
        <Input.OTP length={6} size="large" autoFocus />
      </Form.Item>
      <Button type="primary" htmlType="submit" size="large" block loading={busy} icon={<SafetyOutlined />}>
        Verify
      </Button>
    </Form>
  );
}

function CodeStep() {
  const { verifyCode, signOut } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <Title level={3} className="page-title">
        Two-factor code
      </Title>
      <Paragraph type="secondary" style={{ marginTop: 6 }}>
        Open your authenticator app and type the 6-digit code for dvote.
      </Paragraph>
      {error ? <Alert type="error" showIcon message={error} style={{ marginBottom: 16 }} /> : null}
      <CodeInput
        busy={busy}
        onSubmit={async (code) => {
          setBusy(true);
          setError(null);
          try {
            await verifyCode(code);
          } catch (err) {
            setError(errorMessage(err));
          } finally {
            setBusy(false);
          }
        }}
      />
      <Button type="link" block onClick={() => void signOut()} style={{ marginTop: 8 }}>
        Use another account
      </Button>
    </>
  );
}

function EnrollStep() {
  const { startEnroll, confirmEnroll, signOut } = useAuth();
  const [enroll, setEnroll] = useState<Enrollment | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    startEnroll().then(setEnroll, (err: unknown) => setError(errorMessage(err)));
  }, [startEnroll]);

  return (
    <>
      <Title level={3} className="page-title">
        Set up two-factor sign-in
      </Title>
      <Paragraph type="secondary" style={{ marginTop: 6 }}>
        Admin accounts need an authenticator app (Google Authenticator, Microsoft Authenticator…). Scan this QR
        with it, then type the 6-digit code it shows.
      </Paragraph>
      <Flex justify="center" style={{ margin: '8px 0 16px' }}>
        {enroll ? <img src={enroll.qrCode} alt="Authenticator QR code" width={180} height={180} /> : <Spin />}
      </Flex>
      {enroll ? (
        <Paragraph type="secondary" style={{ fontSize: 12, textAlign: 'center' }}>
          Can't scan? Enter this key: <Text copyable code>{enroll.secret}</Text>
        </Paragraph>
      ) : null}
      {error ? <Alert type="error" showIcon message={error} style={{ marginBottom: 16 }} /> : null}
      <CodeInput
        busy={busy}
        onSubmit={async (code) => {
          if (!enroll) return;
          setBusy(true);
          setError(null);
          try {
            await confirmEnroll(enroll.factorId, code);
          } catch (err) {
            setError(errorMessage(err));
          } finally {
            setBusy(false);
          }
        }}
      />
      <Button type="link" block onClick={() => void signOut()} style={{ marginTop: 8 }}>
        Use another account
      </Button>
    </>
  );
}
