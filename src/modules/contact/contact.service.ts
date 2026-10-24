import { prisma } from '../../lib/prisma';

export class ContactService {
  async createMessage(data: {
    name: string;
    phone: string;
    email?: string;
    message: string;
    attribution?: any;
    locale?: string;
  }) {
    return prisma.contactMessage.create({
      data: {
        name: data.name,
        phone: data.phone,
        email: data.email,
        message: data.message,
        attribution: data.attribution || {},
        locale: data.locale || 'ar',
      },
    });
  }

  async createQuote(data: {
    type: 'model_request' | 'area_request';
    name: string;
    phone: string;
    details?: string;
    attribution?: any;
  }) {
    return prisma.quoteRequest.create({
      data: {
        type: data.type,
        name: data.name,
        phone: data.phone,
        details: data.details,
        attribution: data.attribution || {},
      },
    });
  }

  async getMessages(take = 50) {
    return prisma.contactMessage.findMany({
      orderBy: { created_at: 'desc' },
      take,
    });
  }

  async getQuotes(take = 50) {
    return prisma.quoteRequest.findMany({
      orderBy: { created_at: 'desc' },
      take,
    });
  }

  async updateMessageStatus(id: string, status: string) {
    return prisma.contactMessage.update({
      where: { id },
      data: { status },
    });
  }
}

export const contactService = new ContactService();
