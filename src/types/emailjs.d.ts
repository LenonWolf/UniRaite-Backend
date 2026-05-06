declare module '@emailjs/nodejs' {
  export function send(
    serviceId: string,
    templateId: string,
    templateParams: Record<string, any>,
    options: { publicKey: string; privateKey: string }
  ): Promise<{ status: number; text: string }>;
}