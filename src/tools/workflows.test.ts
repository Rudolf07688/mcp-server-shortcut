import { expect, test, describe, mock } from "bun:test";
import { WorkflowTools } from "./workflows";
import type { ShortcutClientWrapper } from "@/client/shortcut";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Workflow } from "@shortcut/client";

describe("WorkflowTools", () => {
	const mockWorkflows: Workflow[] = [
		{
			id: 1,
			name: "Workflow 1",
			description: "Description for Workflow 1",
			default_state_id: 101,
			states: [
				{ id: 101, name: "Unstarted", type: "unstarted" },
				{ id: 102, name: "Started", type: "started" },
				{ id: 103, name: "Done", type: "done" },
			],
		} as Workflow,
		{
			id: 2,
			name: "Workflow 2",
			description: "Description for Workflow 2",
			default_state_id: 201,
			states: [
				{ id: 201, name: "Backlog", type: "unstarted" },
				{ id: 202, name: "In Progress", type: "started" },
				{ id: 203, name: "Completed", type: "done" },
			],
		} as Workflow,
	];

	describe("create method", () => {
		test("should register the correct tools with the server", () => {
			const mockClient = {} as ShortcutClientWrapper;
			const mockTool = mock();
			const mockServer = { tool: mockTool } as unknown as McpServer;

			WorkflowTools.create(mockClient, mockServer);

			expect(mockTool).toHaveBeenCalledTimes(2);

			expect(mockTool.mock.calls?.[0]?.[0]).toBe("get-workflow");
			expect(mockTool.mock.calls?.[1]?.[0]).toBe("list-workflows");
		});
	});

	describe("getWorkflow method", () => {
		const getWorkflowMock = mock(async (id: number) =>
			mockWorkflows.find((workflow) => workflow.id === id),
		);
		const mockClient = { getWorkflow: getWorkflowMock } as unknown as ShortcutClientWrapper;

		test("should return formatted workflow details when workflow is found", async () => {
			const workflowTools = new WorkflowTools(mockClient);
			const result = await workflowTools.getWorkflow(1);

			expect(result.content[0].type).toBe("text");
			expect(String(result.content[0].text).split("\n")).toMatchObject([
				"Id: 1",
				"Name: Workflow 1",
				"Description: Description for Workflow 1",
				"States:",
				"- id=101 name=Unstarted (default: yes, type: unstarted)",
				"- id=102 name=Started (default: no, type: started)",
				"- id=103 name=Done (default: no, type: done)",
			]);
		});

		test("should handle workflow not found", async () => {
			const workflowTools = new WorkflowTools({
				getWorkflow: mock(async () => null),
			} as unknown as ShortcutClientWrapper);

			const result = await workflowTools.getWorkflow(999);

			expect(result.content[0].type).toBe("text");
			expect(result.content[0].text).toBe("Workflow with public ID: 999 not found.");
		});
	});

	describe("listWorkflows method", () => {
		const getWorkflowsMock = mock(async () => mockWorkflows);
		const mockClient = { getWorkflows: getWorkflowsMock } as unknown as ShortcutClientWrapper;

		test("should return formatted list of workflows when workflows are found", async () => {
			const workflowTools = new WorkflowTools(mockClient);
			const result = await workflowTools.listWorkflows();

			expect(result.content[0].type).toBe("text");
			expect(String(result.content[0].text).split("\n")).toMatchObject([
				"Result (first 2 shown of 2 total workflows found):",
				"",
				"Id: 1",
				"Name: Workflow 1",
				"Description: Description for Workflow 1",
				"Default State: Unstarted",
				"",
				"Id: 2",
				"Name: Workflow 2",
				"Description: Description for Workflow 2",
				"Default State: Backlog",
			]);
		});
	});

	test("should return no workflows found message when no workflows exist", async () => {
		const workflowTools = new WorkflowTools({
			getWorkflows: mock(async () => []),
		} as unknown as ShortcutClientWrapper);

		const result = await workflowTools.listWorkflows();

		expect(result.content[0].type).toBe("text");
		expect(result.content[0].text).toBe("No workflows found.");
	});

	test("should handle workflow with unknown default state", async () => {
		const workflowTools = new WorkflowTools({
			getWorkflows: mock(async () => [
				{
					id: 3,
					name: "Workflow 3",
					description: "Description for Workflow 3",
					default_state_id: 999, // Non-existent state ID
					states: [
						{ id: 301, name: "Unstarted", type: "unstarted" },
						{ id: 302, name: "Started", type: "started" },
					],
				} as Workflow,
			]),
		} as unknown as ShortcutClientWrapper);

		const result = await workflowTools.listWorkflows();

		expect(result.content[0].type).toBe("text");
		expect(String(result.content[0].text).split("\n")).toMatchObject([
			"Result (first 1 shown of 1 total workflows found):",
			"",
			"Id: 3",
			"Name: Workflow 3",
			"Description: Description for Workflow 3",
			"Default State: [Unknown]",
		]);
	});
});
