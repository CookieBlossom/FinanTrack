import { Request, Response, NextFunction } from 'express';
import { BankService } from '../services/bank.service';

export class BankController {
  private service: BankService;
  constructor() {
    this.service = new BankService();
  }

  public getAllBanks = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const banks = await this.service.getAllBanks();
      res.json(banks);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
    }
  };
}