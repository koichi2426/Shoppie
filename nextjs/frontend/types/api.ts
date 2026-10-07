import type { components, operations } from '@/gen/api';

export type Product = components['schemas']['ProductSchema'];
export type AgentResponse = components['schemas']['AgentResponseSchema'];
export type RequestAssistanceResponse = components['schemas']['RequestAssistanceResponse'];
export type InteractionEventBody =
  operations['record_interaction_event_events_post']['requestBody']['content']['application/json'];
