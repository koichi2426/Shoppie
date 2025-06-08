import {
    RequestAssistanceUseCase,
    RequestAssistanceInput,
    RequestAssistanceOutput
  } from '@/app/backend/usecase/request_assistance_usecase';
  
  /**
   * ショッピング支援ユースケースのAPIアダプタ
   */
  export class RequestAssistanceAction {
    constructor(private readonly uc: RequestAssistanceUseCase) {}
  
    async execute(input: RequestAssistanceInput): Promise<{
      status: number;
      data: RequestAssistanceOutput | { error: string };
    }> {
      try {
        const result = await this.uc.execute(input);
  
        return {
          status: 201,
          data: result
        };
      } catch (error) {
        return {
          status: 500,
          data: { error: 'Failed to process request assistance' }
        };
      }
    }
  }
  