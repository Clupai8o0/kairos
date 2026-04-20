import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components';

interface Props {
  userName: string;
  verificationUrl: string;
}

export function VerificationEmail({ userName, verificationUrl }: Props) {
  return (
    <Html>
      <Head />
      <Preview>Verify your Kairos email address</Preview>
      <Body style={{ backgroundColor: '#0d0d0f', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
        <Container style={{ maxWidth: '560px', margin: '48px auto', padding: '32px' }}>
          <Heading
            style={{
              color: '#f5f5f7',
              fontSize: '22px',
              fontWeight: '600',
              margin: '0 0 12px',
              letterSpacing: '-0.01em',
            }}
          >
            Verify your email
          </Heading>
          <Text style={{ color: '#a0a0ab', fontSize: '15px', lineHeight: '1.6', margin: '0 0 24px' }}>
            Hi {userName} — click the button below to verify your email address and complete your
            account setup.
          </Text>
          <Section style={{ margin: '0 0 24px' }}>
            <Button
              href={verificationUrl}
              style={{
                backgroundColor: '#6366f1',
                color: '#ffffff',
                padding: '11px 22px',
                borderRadius: '7px',
                fontSize: '14px',
                fontWeight: '500',
                textDecoration: 'none',
                display: 'inline-block',
              }}
            >
              Verify email
            </Button>
          </Section>
          <Text style={{ color: '#52525b', fontSize: '13px', lineHeight: '1.5', margin: '0' }}>
            If you did not sign up for Kairos, you can safely ignore this email.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
