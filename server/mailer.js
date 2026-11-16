const nodemailer = require('nodemailer');

function getTransport() {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) return null;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
}

async function sendAuthLink({ email, purpose, url }) {
  const transporter = getTransport();
  const subjects = {
    verify_email: 'Подтвердите email в Studia',
    reset_password: 'Сброс пароля Studia',
    account_exists: 'Информация о регистрации в Studia',
  };
  if (!transporter) {
    if (process.env.NODE_ENV === 'production') {
      console.error('Отправка писем отключена: SMTP не настроен.');
      return purpose === 'account_exists';
    }
    if (purpose === 'account_exists') {
      console.info(
        `[Studia mail: ${purpose}] ${email} — если вы не регистрировались, проигнорируйте это письмо.`,
      );
      return true;
    }
    console.info(`[Studia mail: ${purpose}] ${email} — ${url}`);
    return true;
  }
  await transporter.sendMail({
    from: process.env.MAIL_FROM || process.env.SMTP_FROM || process.env.SMTP_USER,
    to: email,
    subject: subjects[purpose],
    text:
      purpose === 'account_exists'
        ? 'На этот email уже зарегистрирован аккаунт. Если вы не создавали его, смените пароль через восстановление доступа.'
        : `Откройте ссылку, чтобы продолжить: ${url}\nЕсли вы не запрашивали это письмо, проигнорируйте его.`,
  });
  return true;
}

module.exports = { sendAuthLink };
