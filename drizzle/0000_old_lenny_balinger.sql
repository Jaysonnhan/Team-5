CREATE TABLE `files` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`kind` text NOT NULL,
	`day` integer,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`size` integer NOT NULL,
	`object_key` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `files_project` ON `files` (`project_id`);--> statement-breakpoint
CREATE TABLE `projects` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`document` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`published` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `projects_owner` ON `projects` (`owner_id`);--> statement-breakpoint
CREATE INDEX `projects_public` ON `projects` (`published`,`updated_at`);