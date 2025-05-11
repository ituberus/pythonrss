import { Response } from 'express';

interface SuccessResponse {
  success: true;
  message?: string;
  data?: any;
}

interface ErrorResponse {
  success: false;
  message: string;
  errors?: any;
}

export const successResponse = (res: Response, message: string = 'Success', data: any = null, statusCode: number = 200): Response => {
  const response: SuccessResponse = {
    success: true,
    message,
  };
  
  if (data) {
    response.data = data;
  }
  
  return res.status(statusCode).json(response);
};

export const errorResponse = (res: Response, message: string = 'Error', errors: any = null, statusCode: number = 400): Response => {
  const response: ErrorResponse = {
    success: false,
    message,
  };
  
  if (errors) {
    response.errors = errors;
  }
  
  return res.status(statusCode).json(response);
};