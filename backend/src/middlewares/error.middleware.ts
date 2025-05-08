import { Request, Response, NextFunction } from 'express';
import { ApiError } from '@/libs/ApiError';

type ErrorResponse = {
  success: false;
  message: string;
  errorType: string;
  errors?: ApiError['errors'];
  stack?: string;
  originalError?: string;
};

function getDebugInfo(error: ApiError) {
  if (process.env.NODE_ENV !== 'development') return {};

  return {
    stack: error.stack,
    ...(error.originalError && {
      originalError: error.originalError.message
    })
  };
}
const ErrorHandler = (
  error: unknown, req: Request, res: Response, next: NextFunction
) => {

  const apiError = ApiError.handle(error); // Let ApiError handle all cases

  const response: ErrorResponse = {
    success: false,
    message: apiError.message,
    errorType: apiError.errorType,
    errors: apiError.errors,
    ...getDebugInfo(apiError)
  };

  return res.status(apiError.statusCode).json(response);
}

export default ErrorHandler;