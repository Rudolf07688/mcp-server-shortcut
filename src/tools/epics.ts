import type { ShortcutClientWrapper } from "@/client/shortcut";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { BaseTools } from "./base";
import { formatAsUnorderedList, formatStats } from "./utils/format";
import { type QueryParams, buildSearchQuery } from "./utils/search";
import { date, has, is, user } from "./utils/validation";

export class EpicTools extends BaseTools {
	static create(client: ShortcutClientWrapper, server: McpServer) {
		const tools = new EpicTools(client);

		server.tool(
			"get-epic",
			"Get a Shortcut epic by public ID. Returns detailed information about the epic including:\n" +
				"- Epic name and ID\n" +
				"- URL to view the epic\n" +
				"- Status (archived, completed, started)\n" +
				"- Due date and team assignment\n" +
				"- Statistics about stories within the epic\n" +
				"- Full description",
			{ epicPublicId: z.number().positive().describe("The public ID of the epic to get") },
			async ({ epicPublicId }) => await tools.getEpic(epicPublicId),
		);

		server.tool(
			"search-epics",
			"Find Shortcut epics. You can search using various criteria including name, description, state, and more. Examples:\n" +
				"- To find epics by name: { name: 'Project X' }\n" +
				"- To find epics by state: { state: 'started' }\n" +
				"- To find epics created on a specific date: { created: '2024-03-20' }\n" +
				"- To find epics in a date range: { created: '2024-03-01..2024-03-31' }\n" +
				"- To find epics by team: { team: 'team-name' }\n" +
				"You can combine multiple criteria in a single search.",
			{
				id: z.number().optional().describe("Find only epics with the specified public ID"),
				name: z.string().optional().describe("Find only epics matching the specified name"),
				description: z
					.string()
					.optional()
					.describe("Find only epics matching the specified description"),
				state: z
					.enum(["unstarted", "started", "done"])
					.optional()
					.describe("Find only epics matching the specified state"),
				objective: z
					.number()
					.optional()
					.describe("Find only epics matching the specified objective"),
				owner: user("owner"),
				requester: user("requester"),
				team: z
					.string()
					.optional()
					.describe(
						"Find only epics matching the specified team. Should be a team's mention name.",
					),
				comment: z.string().optional().describe("Find only epics matching the specified comment"),
				isUnstarted: is("unstarted"),
				isStarted: is("started"),
				isDone: is("completed"),
				isArchived: is("archived").default(false),
				isOverdue: is("overdue"),
				hasOwner: has("an owner"),
				hasComment: has("a comment"),
				hasDeadline: has("a deadline"),
				hasLabel: has("a label"),
				created: date,
				updated: date,
				completed: date,
				due: date,
			},
			async (params) => await tools.searchEpics(params),
		);

		server.tool(
			"create-epic",
			"Create a new Shortcut epic. Required fields:\n" +
				"- name: The title of the epic\n" +
				"Optional fields:\n" +
				"- description: A detailed description of the epic's purpose and scope\n" +
				"- started_at_override: The start date for the epic (ISO-8601 format with time, e.g. 2025-04-05T00:00:00Z)\n" +
				"- deadline: The end date for the epic (ISO-8601 format with time, e.g. 2025-04-05T00:00:00Z)\n\n" +
				"Returns the ID of the newly created epic.",
			{
				name: z.string().describe("The name of the epic to create"),
				description: z.string().optional().describe("The description of the epic to create"),
				started_at_override: z
					.string()
					.optional()
					.describe("The start date for the epic (ISO-8601 format with time)"),
				deadline: z
					.string()
					.optional()
					.describe("The end date for the epic (ISO-8601 format with time)"),
			},
			async ({ name, description, started_at_override, deadline }) =>
				await tools.createEpic(name, description, undefined, started_at_override, deadline),
		);

		server.tool(
			"delete-epic",
			"Delete a Shortcut epic by public ID. This action is permanent and cannot be undone.\n" +
				"Requires the epic's public ID number.\n" +
				"Returns a confirmation message if the deletion was successful.",
			{ epicPublicId: z.number().positive().describe("The public ID of the epic to delete") },
			async ({ epicPublicId }) => await tools.deleteEpic(epicPublicId),
		);

		server.tool(
			"list-epics",
			"List all Shortcut epics. Returns a comprehensive list of all epics in the workspace.\n" +
				"Each epic is displayed with its ID and name.\n" +
				"The list is sorted by epic ID and includes both completed and in-progress epics.",
			{},
			async () => await tools.listEpics(),
		);

		server.tool(
			"update-epic",
			"Update a Shortcut epic. You can update various fields including:\n" +
				"- group_id: Assign the epic to a specific team\n" +
				"- name: Change the epic's name\n" +
				"- description: Update the epic's description\n" +
				"- state: Set the epic's state (to do, in progress, done)\n" +
				"- started_at_override: Set the start date (ISO-8601 format with time, e.g. 2025-04-05T00:00:00Z)\n" +
				"- deadline: Set the end date (ISO-8601 format with time, e.g. 2025-04-05T00:00:00Z)\n\n" +
				"Returns the updated epic details.",
			{
				epicPublicId: z.number().positive().describe("The public ID of the epic to update"),
				group_id: z.string().optional().describe("The ID of the team to assign the epic to"),
				name: z.string().optional().describe("The new name for the epic"),
				description: z.string().optional().describe("The new description for the epic"),
				state: z
					.enum(["to do", "in progress", "done"])
					.optional()
					.describe("The new state for the epic"),
				started_at_override: z
					.string()
					.optional()
					.describe("The start date for the epic (ISO-8601 format with time)"),
				deadline: z
					.string()
					.optional()
					.describe("The end date for the epic (ISO-8601 format with time)"),
			},
			async (params) => await tools.updateEpic(params),
		);

		return tools;
	}

	async searchEpics(params: QueryParams) {
		const currentUser = await this.client.getCurrentUser();
		const query = await buildSearchQuery(params, currentUser);
		const { epics, total } = await this.client.searchEpics(query);

		if (!epics) throw new Error(`Failed to search for epics matching your query: "${query}"`);
		if (!epics.length) return this.toResult(`Result: No epics found.`);

		return this.toResult(`Result (first ${epics.length} shown of ${total} total epics found):
${formatAsUnorderedList(epics.map((epic) => `${epic.id}: ${epic.name}`))}`);
	}

	async getEpic(epicPublicId: number) {
		const epic = await this.client.getEpic(epicPublicId);

		if (!epic) throw new Error(`Failed to retrieve Shortcut epic with public ID: ${epicPublicId}`);

		const currentUser = await this.client.getCurrentUser();
		const showPoints = !!currentUser?.workspace2?.estimate_scale?.length;

		return this.toResult(
			`Epic: ${epicPublicId}
URL: ${epic.app_url}
Name: ${epic.name}
Archived: ${epic.archived ? "Yes" : "No"}
Completed: ${epic.completed ? "Yes" : "No"}
Started: ${epic.started ? "Yes" : "No"}
Due date: ${epic.deadline ? epic.deadline : "[Not set]"}
Team: ${epic.group_id ? `${epic.group_id}` : "[None]"}
Objective: ${epic.milestone_id ? `${epic.milestone_id}` : "[None]"}

${formatStats(epic.stats, showPoints)}

Description:
${epic.description}`,
		);
	}

	async createEpic(
		name: string,
		description?: string,
		team_name?: string,
		started_at_override?: string,
		deadline?: string,
	) {
		const epic = await this.client.createEpic({
			name,
			description,
			team_name,
			started_at_override,
			deadline,
		});

		if (!epic) throw new Error(`Failed to create Shortcut epic: ${name}`);

		return this.toResult(`Epic created: ${epic.id}`);
	}

	async deleteEpic(epicPublicId: number) {
		await this.client.deleteEpic(epicPublicId);
		return this.toResult(`Epic deleted: ${epicPublicId}`);
	}

	async listEpics() {
		const { epics, total } = await this.client.listEpics();

		if (!epics) throw new Error("Failed to list epics");
		if (!epics.length) return this.toResult("No epics found.");

		return this.toResult(`Found ${total} epics:
${formatAsUnorderedList(epics.map((epic) => `${epic.id}: ${epic.name}`))}`);
	}

	async updateEpic(params: {
		epicPublicId: number;
		group_id?: string;
		name?: string;
		description?: string;
		state?: "to do" | "in progress" | "done";
		started_at_override?: string;
		deadline?: string;
	}) {
		const { epicPublicId, ...updateParams } = params;
		const epic = await this.client.updateEpic(epicPublicId, updateParams);

		if (!epic) throw new Error(`Failed to update Shortcut epic with public ID: ${epicPublicId}`);

		return this.toResult(`Epic updated: ${epic.id}`);
	}
}
