"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPasswordResetTemplate = getPasswordResetTemplate;
function getPasswordResetTemplate(resetUrl) {
    return `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px; min-height: 100vh;">
        <div style="max-width: 600px; margin: auto; background-color: #ffffff; border-radius: 16px; padding: 40px; box-shadow: 0 8px 32px rgba(0,0,0,0.15); backdrop-filter: blur(10px); border: 1px solid rgba(255, 255, 255, 0.2);">
          <div style="text-align: center; margin-bottom: 30px;">
            <h2 style="color: #333; margin: 0; font-size: 28px; font-weight: 600;">🔐 Recupera tu contraseña</h2>
            <div style="width: 80px; height: 4px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); margin: 20px auto; border-radius: 2px;"></div>
          </div>
          
          <p style="font-size: 18px; color: #4a5568; line-height: 1.6; margin-bottom: 20px;">
            Hola, recibimos una solicitud para restablecer tu contraseña de <strong style="color: #667eea;">FinanTrack</strong>.
          </p>
          
          <p style="font-size: 16px; color: #4a5568; line-height: 1.6; margin-bottom: 30px;">
            Haz clic en el siguiente botón para establecer una nueva contraseña. Este enlace será válido por <strong>1 hora</strong>.
          </p>
          
          <div style="text-align: center; margin: 40px 0;">
            <a href="${resetUrl}" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; padding: 16px 32px; text-decoration: none; border-radius: 12px; font-size: 18px; font-weight: 600; box-shadow: 0 4px 16px rgba(102, 126, 234, 0.3); transition: all 0.3s ease; display: inline-block; letter-spacing: 0.5px;">
              🔓 Restablecer contraseña
            </a>
          </div>
          
          <div style="background: #f8f9fa; padding: 20px; border-radius: 12px; margin: 30px 0;">
            <p style="font-size: 14px; color: #718096; margin: 0; text-align: center;">
              💡 <strong>Consejo de seguridad:</strong> Si no solicitaste este cambio, puedes ignorar este mensaje. Tu contraseña actual seguirá siendo segura.
            </p>
          </div>
          
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;">
          
          <div style="text-align: center;">
            <p style="font-size: 14px; color: #718096; margin: 10px 0;">
              Con cariño,<br>
              <span style="color: #667eea; font-weight: 600;">— El equipo de FinanTrack</span>
            </p>
            <p style="font-size: 12px; color: #a0aec0; margin: 5px 0;">
              Gestiona tus finanzas con inteligencia
            </p>
          </div>
        </div>
        
        <div style="text-align: center; margin-top: 30px;">
          <p style="font-size: 12px; color: rgba(255, 255, 255, 0.7); margin: 0;">
            Si tienes problemas con el botón, copia y pega este enlace en tu navegador:
          </p>
          <p style="font-size: 12px; color: rgba(255, 255, 255, 0.9); margin: 10px 0; word-break: break-all;">
            ${resetUrl}
          </p>
        </div>
      </div>
    `;
}
//# sourceMappingURL=templates.js.map