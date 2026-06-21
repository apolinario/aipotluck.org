import { z } from "zod";
import { endpointOAIParametersSchema, endpointOai } from "./openai/endpointOai";
import { endpointAgentParametersSchema, endpointAgent } from "./agent/endpointAgent";

// The endpoint type surface (Endpoint, EndpointParameters, EndpointMessage,
// TextGenerationStreamOutputSimplified) lives in ./types — a leaf module the endpoint
// implementations can import without cycling back through this registry.

// list of all endpoint generators
export const endpoints = {
	openai: endpointOai,
	agent: endpointAgent,
};

export const endpointSchema = z.discriminatedUnion("type", [
	endpointOAIParametersSchema,
	endpointAgentParametersSchema,
]);
export default endpoints;
