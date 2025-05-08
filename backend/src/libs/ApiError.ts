import { ZodError } from 'zod';
import { Response } from 'express';
import mongoose from 'mongoose';
import { AxiosError } from "axios";
import { verify } from 'crypto';

type ErrorType =
    | 'VALIDATION_ERROR'
    | 'AUTHENTICATION_ERROR'
    | 'DATABASE_ERROR'
    | 'API_ERROR'
    | 'NOT_FOUND'
    | 'FORBIDDEN'
    | 'CONFLICT'
    | 'UNPROCESSABLE_ENTITY'
    | 'UNKNOWN_ERROR'
    | 'NETWORK_ERROR'
    | 'INTERNAL_SERVER_ERROR'
    | 'BAD_REQUEST'
    | 'VERIFICATION_ERROR'
    | 'INTERNAL_ERROR';

type ErrorResponse = {
    success: false;
    message: string;
    errorType: string;
    errors?: Array<{
        field: string;
        message: string;
        code?: string;
    }>;
    stack?: string;
};

class ApiError extends Error {
    public readonly statusCode: number;
    public readonly errorType: ErrorType;
    public readonly errors?: ErrorResponse['errors'];
    public originalError?: Error;

    constructor(
        statusCode: number,
        message: string,
        config: {
            errorType?: ErrorType; // Made optional to allow default value
            errors?: ErrorResponse['errors'];
            originalError?: Error;
        }
    ) {
        super(message);
        this.statusCode = statusCode;
        this.errorType = config.errorType || 'VALIDATION_ERROR'; // Default to VALIDATION_ERROR
        this.errors = config.errors;
        this.originalError = config.originalError;

        this.stack = config.originalError?.stack || (Error.captureStackTrace(this, this.constructor), this.stack);
    }

    static fromMongooseError(mongooseError: mongoose.Error.ValidationError): ApiError {
        const errors = Object.entries(mongooseError.errors).map(([field, error]) => ({
            field,
            message: error.message,
            code: error.kind,
        }));

        return new ApiError(400, 'Validation failed', {
            errorType: 'VALIDATION_ERROR',
            errors,
            originalError: mongooseError,
        });
    }

    static fromZodError(zodError: ZodError): ApiError {
        const errors = zodError.errors.map((issue) => ({
            field: issue.path.join('.'),
            message: issue.message,
            code: issue.code,
        }));

        return new ApiError(400, 'Validation failed', {
            errorType: 'VALIDATION_ERROR',
            errors,
            originalError: zodError,
        });
    }

    static fromAxiosError(axiosError: AxiosError): ApiError {
        if (axiosError.response) {
            // Handle server response errors (4xx, 5xx)
            const { data, status } = axiosError.response;
            const responseData = data as any;

            if (status === 400 && responseData.errors) {
                // Handle validation errors from server
                const errors = Object.entries(responseData.errors).map(([field, error]: [string, any]) => ({
                    field,
                    message: error.message || 'Validation error',
                    code: error.code || 'VALIDATION_ERROR',
                }));

                return new ApiError(status, responseData.message || 'Validation failed', {
                    errorType: 'VALIDATION_ERROR',
                    errors,
                    originalError: axiosError,
                });
            }

            // Generic server error
            return new ApiError(
                status,
                responseData.message || 'Request failed',
                {
                    errorType: 'API_ERROR',
                    originalError: axiosError,
                }
            );
        } else if (axiosError.request) {
            // Handle request errors (no response received)
            return new ApiError(
                0,
                'No response received from server',
                {
                    errorType: 'NETWORK_ERROR',
                    originalError: axiosError,
                }
            );
        }

        // Handle other Axios errors
        return new ApiError(
            500,
            'Request setup failed',
            {
                errorType: 'INTERNAL_ERROR',
                originalError: axiosError,
            }
        );
    }

    static handle(error: unknown, res?: Response): ApiError {
        let apiError: ApiError;

        if (error instanceof ZodError) {
            apiError = ApiError.fromZodError(error);
        } else if (error instanceof mongoose.Error.ValidationError) {
            apiError = ApiError.fromMongooseError(error);
        } else if (error instanceof AxiosError) {
            apiError = ApiError.fromAxiosError(error);
        } else if (error instanceof ApiError) {
            apiError = error;
        } else if (error instanceof Error) {
            apiError = ApiError.create(500, error.message, 'INTERNAL_ERROR', undefined, error);
        } else {
            apiError = ApiError.create(500, 'Unknown error occurred', 'UNKNOWN_ERROR');
        }

        if (res) {
            const response: ErrorResponse = {
                success: false,
                message: apiError.message,
                errorType: apiError.errorType,
                errors: apiError.errors,
                ...(process.env.NODE_ENV === 'development' && { stack: apiError.stack }),
            };
            res.status(apiError.statusCode).json(response);
        }

        return apiError;
    }

    // Generic Factory Method
    static create(
        statusCode: number,
        message: string,
        errorType: ErrorType,
        errors?: ErrorResponse['errors'],
        originalError?: Error
    ): ApiError {
        return new ApiError(statusCode, message, {
            errorType,
            errors,
            originalError,
        });
    }
}

// Optional: Shortcuts using generic method
const errorMap = {
    badRequest: [400, 'BAD_REQUEST'],
    unauthorized: [401, 'AUTHENTICATION_ERROR'],
    forbidden: [403, 'FORBIDDEN'],
    notFound: [404, 'NOT_FOUND'],
    internal: [500, 'INTERNAL_ERROR'],
    unknown: [500, 'UNKNOWN_ERROR'],
    networkError: [0, 'NETWORK_ERROR'],
    apiError: [400, 'API_ERROR'],
    verifyError: [403, 'VERIFICATION_REQUIRED'],
    validationError: [422, 'VALIDATION_ERROR'],
} as const;

for (const [method, [code, type]] of Object.entries(errorMap)) {
    // @ts-ignore
    ApiError[method] = (message = type.replace(/_/g, ' '), errors?: ErrorResponse['errors']) =>
        ApiError.create(code, message, type as ErrorType, errors);
}

export { ApiError };