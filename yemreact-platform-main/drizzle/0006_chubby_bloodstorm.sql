CREATE TABLE `engagementEvents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`reactionId` int NOT NULL,
	`kind` enum('view','download') NOT NULL,
	`fingerprintHash` varchar(128) NOT NULL,
	`windowBucket` varchar(32) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `engagementEvents_id` PRIMARY KEY(`id`),
	CONSTRAINT `engagement_window_unique` UNIQUE(`reactionId`,`kind`,`fingerprintHash`,`windowBucket`)
);
--> statement-breakpoint
CREATE TABLE `rateLimitBuckets` (
	`keyHash` varchar(128) NOT NULL,
	`windowStartedAt` timestamp NOT NULL,
	`count` int NOT NULL DEFAULT 0,
	`expiresAt` timestamp NOT NULL,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `rateLimitBuckets_keyHash` PRIMARY KEY(`keyHash`)
);
--> statement-breakpoint
CREATE TABLE `searchEvents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`normalizedQuery` varchar(255) NOT NULL,
	`sessionHash` varchar(128) NOT NULL,
	`userId` int,
	`reactionId` int,
	`eventType` enum('result_view','result_click','save') NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `searchEvents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `videoProcessingJobs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`jobType` enum('reaction','contribution') NOT NULL,
	`reactionId` int,
	`contributionId` int,
	`status` enum('pending','processing','ready','failed') NOT NULL DEFAULT 'pending',
	`attempts` int NOT NULL DEFAULT 0,
	`maxAttempts` int NOT NULL DEFAULT 3,
	`runAfter` timestamp NOT NULL DEFAULT (now()),
	`lockedAt` timestamp,
	`lockToken` varchar(96),
	`lastError` text,
	`idempotencyKey` varchar(96) NOT NULL,
	`completedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `videoProcessingJobs_id` PRIMARY KEY(`id`),
	CONSTRAINT `videoProcessingJobs_idempotencyKey_unique` UNIQUE(`idempotencyKey`)
);
--> statement-breakpoint
DROP INDEX `reactions_engagement_idx` ON `reactions`;--> statement-breakpoint
ALTER TABLE `contributions` ADD `uploadIdempotencyKey` varchar(96);--> statement-breakpoint
ALTER TABLE `contributions` ADD `approvalIdempotencyKey` varchar(96);--> statement-breakpoint
ALTER TABLE `reactions` ADD `popularityScore` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `reactions` ADD `mediaIdempotencyKey` varchar(96);--> statement-breakpoint
ALTER TABLE `contributions` ADD CONSTRAINT `contributions_uploadIdempotencyKey_unique` UNIQUE(`uploadIdempotencyKey`);--> statement-breakpoint
ALTER TABLE `contributions` ADD CONSTRAINT `contributions_approvalIdempotencyKey_unique` UNIQUE(`approvalIdempotencyKey`);--> statement-breakpoint
ALTER TABLE `reactions` ADD CONSTRAINT `reactions_mediaIdempotencyKey_unique` UNIQUE(`mediaIdempotencyKey`);--> statement-breakpoint
ALTER TABLE `engagementEvents` ADD CONSTRAINT `engagementEvents_reactionId_reactions_id_fk` FOREIGN KEY (`reactionId`) REFERENCES `reactions`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `searchEvents` ADD CONSTRAINT `searchEvents_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `searchEvents` ADD CONSTRAINT `searchEvents_reactionId_reactions_id_fk` FOREIGN KEY (`reactionId`) REFERENCES `reactions`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `videoProcessingJobs` ADD CONSTRAINT `videoProcessingJobs_reactionId_reactions_id_fk` FOREIGN KEY (`reactionId`) REFERENCES `reactions`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `videoProcessingJobs` ADD CONSTRAINT `videoProcessingJobs_contributionId_contributions_id_fk` FOREIGN KEY (`contributionId`) REFERENCES `contributions`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `engagement_reaction_created_idx` ON `engagementEvents` (`reactionId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `rate_limit_expires_idx` ON `rateLimitBuckets` (`expiresAt`);--> statement-breakpoint
CREATE INDEX `search_events_query_type_idx` ON `searchEvents` (`normalizedQuery`,`eventType`,`createdAt`);--> statement-breakpoint
CREATE INDEX `search_events_reaction_idx` ON `searchEvents` (`reactionId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `video_jobs_status_run_after_idx` ON `videoProcessingJobs` (`status`,`runAfter`);--> statement-breakpoint
CREATE INDEX `video_jobs_reaction_idx` ON `videoProcessingJobs` (`reactionId`);--> statement-breakpoint
CREATE INDEX `video_jobs_contribution_idx` ON `videoProcessingJobs` (`contributionId`);--> statement-breakpoint
CREATE INDEX `reactions_engagement_idx` ON `reactions` (`status`,`popularityScore`,`publishedAt`);