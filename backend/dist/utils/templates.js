"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPasswordResetTemplate = getPasswordResetTemplate;
function getPasswordResetTemplate(resetUrl) {
    return `
      <div style="font-family: Arial, sans-serif; background-color: #f6f8fb; padding: 20px;">
        <div style="max-width: 600px; margin: auto; background-color: #ffffff; border-radius: 8px; padding: 30px; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
          <h2 style="color: #2e3a59;">Recupera tu contraseña</h2>
          <p style="font-size: 16px; color: #4a5568;">
            Hola, recibimos una solicitud para restablecer tu contraseña de <strong>FinanTrack</strong>.
          </p>
          <p style="font-size: 16px; color: #4a5568;">
            Haz clic en el siguiente botón para establecer una nueva contraseña. Este enlace será válido por 1 hora.
          </p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" style="background-color: #2563eb; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-size: 16px;">
              Restablecer contraseña
            </a>
          </div>
          <p style="font-size: 14px; color: #718096;">
            Si no solicitaste este cambio, puedes ignorar este mensaje.
          </p>
          <p style="font-size: 14px; color: #718096;">
            — El equipo de FinanTrack
          </p>
        </div>
      </div>
    `;
}
//# sourceMappingURL=templates.js.map