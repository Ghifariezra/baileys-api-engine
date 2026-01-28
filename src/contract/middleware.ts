import { NextFunction, Request, Response } from "express";

export interface Middleware {
    apiKeyMiddleware(req: Request, res: Response, next: NextFunction): void;
}