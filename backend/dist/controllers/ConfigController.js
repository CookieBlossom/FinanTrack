"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConfigController = void 0;
const company_service_1 = require("../services/company.service");
class ConfigController {
    constructor() {
        this.getCompanies = async (req, res) => {
            try {
                const companies = this.companyService.getCompaniesData();
                res.json({
                    success: true,
                    data: companies
                });
            }
            catch (error) {
                console.error('Error al obtener companies:', error);
                res.status(500).json({
                    success: false,
                    message: 'Error al obtener la configuración de companies'
                });
            }
        };
        this.companyService = new company_service_1.CompanyService();
    }
}
exports.ConfigController = ConfigController;
//# sourceMappingURL=ConfigController.js.map