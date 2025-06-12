"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendResetPasswordEmail = void 0;
const nodemailer_1 = __importDefault(require("nodemailer"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const transporter = nodemailer_1.default.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});
const sendResetPasswordEmail = async ({ to, subject, html }) => {
    const mailOptions = {
        from: `"FinanTrack" <${process.env.EMAIL_USER}>`,
        to,
        subject,
        html,
    };
    await transporter.sendMail(mailOptions);
};
exports.sendResetPasswordEmail = sendResetPasswordEmail;
//# sourceMappingURL=mailer.js.map