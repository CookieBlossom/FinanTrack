import { Request, Response } from 'express';
import { CompanyService } from '../services/company.service';

export class ConfigController {
    private companyService: CompanyService;

    constructor() {
        this.companyService = new CompanyService();
    }

    public getCompanies = async (req: Request, res: Response) => {
        try {
            const companies = this.companyService.getCompaniesData();
            res.json({
                success: true,
                data: companies
            });
        } catch (error) {
            console.error('Error al obtener companies:', error);
            res.status(500).json({
                success: false,
                message: 'Error al obtener la configuración de companies'
            });
        }
    };
} 