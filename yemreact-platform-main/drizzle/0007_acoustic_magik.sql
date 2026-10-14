ALTER TABLE `engagementEvents` DROP FOREIGN KEY `engagementEvents_reactionId_reactions_id_fk`;
--> statement-breakpoint
ALTER TABLE `searchEvents` DROP FOREIGN KEY `searchEvents_userId_users_id_fk`;
--> statement-breakpoint
ALTER TABLE `searchEvents` DROP FOREIGN KEY `searchEvents_reactionId_reactions_id_fk`;
--> statement-breakpoint
ALTER TABLE `videoProcessingJobs` DROP FOREIGN KEY `videoProcessingJobs_reactionId_reactions_id_fk`;
--> statement-breakpoint
ALTER TABLE `videoProcessingJobs` DROP FOREIGN KEY `videoProcessingJobs_contributionId_contributions_id_fk`;
--> statement-breakpoint
ALTER TABLE `engagementEvents` ADD CONSTRAINT `engagementEvents_reactionId_reactions_id_fk` FOREIGN KEY (`reactionId`) REFERENCES `reactions`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `searchEvents` ADD CONSTRAINT `searchEvents_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `searchEvents` ADD CONSTRAINT `searchEvents_reactionId_reactions_id_fk` FOREIGN KEY (`reactionId`) REFERENCES `reactions`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `videoProcessingJobs` ADD CONSTRAINT `videoProcessingJobs_reactionId_reactions_id_fk` FOREIGN KEY (`reactionId`) REFERENCES `reactions`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `videoProcessingJobs` ADD CONSTRAINT `videoProcessingJobs_contributionId_contributions_id_fk` FOREIGN KEY (`contributionId`) REFERENCES `contributions`(`id`) ON DELETE cascade ON UPDATE no action;