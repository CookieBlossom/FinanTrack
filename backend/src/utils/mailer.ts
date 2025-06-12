import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
dotenv.config();
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER!,
      pass: process.env.EMAIL_PASS!,
    },
  });
  
  export const sendResetPasswordEmail = async ({
    to,
    subject,
    html
  }: {
    to: string;
    subject: string;
    html: string;
  }) => {
    const mailOptions = {
      from: `"FinanTrack" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html,
    };
  
    await transporter.sendMail(mailOptions);
  };
  