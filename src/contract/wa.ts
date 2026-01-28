export interface WAService {
    connect(): Promise<void>;
    sendMessage(number: string, message: string): Promise<boolean>;
    logout(): Promise<void>;
}