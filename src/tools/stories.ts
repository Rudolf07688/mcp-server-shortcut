import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ShortcutClient } from "../shortcut-client";
import { formatMemberList, formatStoryList } from "./utils/format";
import { z } from "zod";
import { date, has, is, user } from "./utils/validation";
import { buildSearchQuery, type QueryParams } from "./utils/search";
import { BaseTools } from "./base";

export class StoryTools extends BaseTools {
	static create(client: ShortcutClient, server: McpServer) {
		const tools = new StoryTools(client);

		server.tool(
			"get-story-branch-name",
			'Get a valid branch name for a specific story. The branch name is a combination of story ID, owner, and story name in the format "[owner]/sc-[id]/[name]". The story name will be truncated if the total length of the branch name exceeds 50 characters.',
			{ storyPublicId: z.number().positive().describe("The public Id of the story") },
			async ({ storyPublicId }) => await tools.getStoryBranchName(storyPublicId),
		);

		server.tool(
			"get-story",
			"Get a Shortcut story by public ID",
			{ storyPublicId: z.number().positive().describe("The public ID of the story to get") },
			async ({ storyPublicId }) => await tools.getStory(storyPublicId),
		);

		server.tool(
			"search-stories",
			"Find Shortcut stories.",
			{
				id: z.number().optional().describe("Find only stories with the specified public ID"),
				name: z.string().optional().describe("Find only stories matching the specified name"),
				description: z
					.string()
					.optional()
					.describe("Find only stories matching the specified description"),
				comment: z.string().optional().describe("Find only stories matching the specified comment"),
				type: z
					.enum(["feature", "bug", "chore"])
					.optional()
					.describe("Find only stories of the specified type"),
				estimate: z
					.number()
					.optional()
					.describe("Find only stories matching the specified estimate"),
				branch: z.string().optional().describe("Find only stories matching the specified branch"),
				commit: z.string().optional().describe("Find only stories matching the specified commit"),
				pr: z.number().optional().describe("Find only stories matching the specified pull request"),
				project: z.number().optional().describe("Find only stories matching the specified project"),
				epic: z.number().optional().describe("Find only stories matching the specified epic"),
				objective: z
					.number()
					.optional()
					.describe("Find only stories matching the specified objective"),
				state: z.string().optional().describe("Find only stories matching the specified state"),
				label: z.string().optional().describe("Find only stories matching the specified label"),
				owner: user("owner"),
				requester: user("requester"),
				team: z
					.string()
					.optional()
					.describe(
						"Find only stories matching the specified team. This can be a team mention name or team name.",
					),
				skillSet: z
					.string()
					.optional()
					.describe("Find only stories matching the specified skill set"),
				productArea: z
					.string()
					.optional()
					.describe("Find only stories matching the specified product area"),
				technicalArea: z
					.string()
					.optional()
					.describe("Find only stories matching the specified technical area"),
				priority: z
					.string()
					.optional()
					.describe("Find only stories matching the specified priority"),
				severity: z
					.string()
					.optional()
					.describe("Find only stories matching the specified severity"),
				isDone: is("completed"),
				isStarted: is("started"),
				isUnstarted: is("unstarted"),
				isUnestimated: is("unestimated"),
				isOverdue: is("overdue"),
				isArchived: is("archived"),
				isBlocker: is("blocking"),
				isBlocked: is("blocked"),
				hasComment: has("a comment"),
				hasLabel: has("a label"),
				hasDeadline: has("a deadline"),
				hasOwner: has("an owner"),
				hasPr: has("a pr"),
				hasCommit: has("a commit"),
				hasBranch: has("a branch"),
				hasEpic: has("an epic"),
				hasTask: has("a task"),
				hasAttachment: has("an attachment"),
				created: date,
				updated: date,
				completed: date,
				due: date,
			},
			async (params) => await tools.searchStories(params),
		);

		server.tool(
			"create-story",
			`Create a new Shortcut story. 
Name and Workflow are required. If a team is specified, the workflow is optional, and we will use the default workflow for that team instead.
The story will be added to the default state for the workflow.
`,
			{
				name: z.string().min(1).max(512).describe("The name of the story. Required."),
				description: z.string().max(10_000).optional().describe("The description of the story"),
				type: z
					.enum(["feature", "bug", "chore"])
					.default("feature")
					.describe("The type of the story"),
				owner: z.string().optional().describe("The user id of the owner of the story"),
				epic: z.number().optional().describe("The epic id of the epic the story belongs to"),
				team: z
					.string()
					.optional()
					.describe(
						"The team id of the team the story belongs to. Required unless a workflow is specified.",
					),
				workflow: z
					.number()
					.optional()
					.describe("The workflow to add the story to. Required unless a team is specified."),
			},
			async ({ name, description, type, owner, epic, team, workflow }) =>
				await tools.createStory({ name, description, type, owner, epic, team, workflow }),
		);

		server.tool(
			"assign-current-user-as-owner",
			"Assign the current user as the owner of a story",
			{ storyPublicId: z.number().positive().describe("The public ID of the story") },
			async ({ storyPublicId }) => await tools.assignCurrentUserAsOwner(storyPublicId),
		);

		server.tool(
			"unassign-current-user-as-owner",
			"Unassign the current user as the owner of a story",
			{ storyPublicId: z.number().positive().describe("The public ID of the story") },
			async ({ storyPublicId }) => await tools.unassignCurrentUserAsOwner(storyPublicId),
		);

		return tools;
	}

	async assignCurrentUserAsOwner(storyPublicId: number) {
		const story = await this.client.getStory(storyPublicId);

		if (!story)
			throw new Error(`Failed to retrieve Shortcut story with public ID: ${storyPublicId}`);

		const currentUser = await this.client.getCurrentUser();

		if (!currentUser) throw new Error("Failed to retrieve current user");

		if (story.owner_ids.includes(currentUser.id))
			return this.toResult(`Current user is already an owner of story sc-${storyPublicId}`);

		await this.client.updateStory(storyPublicId, {
			owner_ids: story.owner_ids.concat([currentUser.id]),
		});

		return this.toResult(`Assigned current user as owner of story sc-${storyPublicId}`);
	}

	async unassignCurrentUserAsOwner(storyPublicId: number) {
		const story = await this.client.getStory(storyPublicId);

		if (!story)
			throw new Error(`Failed to retrieve Shortcut story with public ID: ${storyPublicId}`);

		const currentUser = await this.client.getCurrentUser();

		if (!currentUser) throw new Error("Failed to retrieve current user");

		if (!story.owner_ids.includes(currentUser.id))
			return this.toResult(`Current user is not an owner of story sc-${storyPublicId}`);

		await this.client.updateStory(storyPublicId, {
			owner_ids: story.owner_ids.filter((ownerId) => ownerId !== currentUser.id),
		});

		return this.toResult(`Unassigned current user as owner of story sc-${storyPublicId}`);
	}

	async getStoryBranchName(storyPublicId: number) {
		const currentUser = await this.client.getCurrentUser();
		if (!currentUser) throw new Error("Unable to find current user");

		const story = await this.client.getStory(storyPublicId);

		if (!story)
			throw new Error(`Failed to retrieve Shortcut story with public ID: ${storyPublicId}`);

		const branchName = `${currentUser.mention_name}/sc-${storyPublicId}/${story.name
			.toLowerCase()
			.replace(/\s+/g, "-")
			.replace(/[^\w\-]/g, "")}`;
		return this.toResult(
			`Branch name for story sc-${storyPublicId}: ${branchName.substring(0, 50)}`,
		);
	}
	//amcd/sc-283926/we-got-a-404-when-trying-to-fetch-a
	async createStory({
		name,
		description,
		type,
		owner,
		epic,
		team,
		workflow,
	}: {
		name: string;
		description?: string;
		type: "feature" | "bug" | "chore";
		owner?: string;
		epic?: number;
		team?: string;
		workflow?: number;
	}) {
		if (!workflow && !team) throw new Error("Team or Workflow has to be specified");

		if (!workflow && team) {
			const fullTeam = await this.client.getTeam(team);
			workflow = fullTeam?.workflow_ids?.[0];
		}

		if (!workflow) throw new Error("Failed to find workflow for team");

		const fullWorkflow = await this.client.getWorkflow(workflow);
		if (!fullWorkflow) throw new Error("Failed to find workflow");

		const story = await this.client.createStory({
			name,
			description,
			story_type: type,
			owner_ids: owner ? [owner] : [],
			epic_id: epic,
			group_id: team,
			workflow_state_id: fullWorkflow.default_state_id,
		});

		return this.toResult(`Created story: ${story.id}`);
	}

	async searchStories(params: QueryParams) {
		const currentUser = await this.client.getCurrentUser();
		const query = await buildSearchQuery(params, currentUser);
		const { stories, total } = await this.client.searchStories(query);

		if (!stories) throw new Error(`Failed to search for stories matching your query: "${query}".`);
		if (!stories.length) return this.toResult(`Result: No stories found.`);

		const users = await this.client.getUserMap(stories.flatMap((story) => story.owner_ids));

		return this.toResult(`Result (first ${stories.length} shown of ${total} total stories found):
${formatStoryList(stories, users)}`);
	}

	async getStory(storyPublicId: number) {
		const story = await this.client.getStory(storyPublicId);

		if (!story)
			throw new Error(`Failed to retrieve Shortcut story with public ID: ${storyPublicId}.`);

		const owners = await this.client.getUserMap(story.owner_ids);

		return this.toResult(`Story: sc-${storyPublicId}
URL: ${story.app_url}
Name: ${story.name}
Type: ${story.story_type}
Archived: ${story.archived ? "Yes" : "No"}
Completed: ${story.completed ? "Yes" : "No"}
Started: ${story.started ? "Yes" : "No"}
Blocked: ${story.blocked ? "Yes" : "No"}
Blocking: ${story.blocker ? "Yes" : "No"}
Due date: ${story.deadline}
Owners: 
${formatMemberList(story.owner_ids, owners)}

Description:
${story.description}

Comments:
${(story.comments || []).map((comment) => `- From: ${comment.author_id} on ${comment.created_at}.\n${comment.text || ""}`).join("\n\n")}
`);
	}
}
