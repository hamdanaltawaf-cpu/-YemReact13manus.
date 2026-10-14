CREATE TABLE `auditEvents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`actorUserId` int,
	`entityType` enum('contribution','reaction','homepage') NOT NULL,
	`entityId` int NOT NULL,
	`action` varchar(96) NOT NULL,
	`details` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `auditEvents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `homePageSettings` (
	`id` int NOT NULL,
	`weeklyReactionId` int,
	`newLibraryLimit` int NOT NULL DEFAULT 12,
	`updatedByUserId` int,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `homePageSettings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `userNotifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`contributionId` int,
	`type` enum('contribution_approved','contribution_rejected') NOT NULL,
	`title` varchar(180) NOT NULL,
	`body` text NOT NULL,
	`readAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `userNotifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `contributions` MODIFY COLUMN `status` enum('pending','reviewing','processing','approved','rejected') NOT NULL DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE `contributions` ADD `trackingCode` varchar(48);--> statement-breakpoint
ALTER TABLE `contributions` ADD `processingStatus` enum('pending','processing','ready','failed') DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE `contributions` ADD `processingError` text;--> statement-breakpoint
ALTER TABLE `contributions` ADD `originalMediaKey` varchar(512);--> statement-breakpoint
ALTER TABLE `contributions` ADD `originalMediaUrl` varchar(1024);--> statement-breakpoint
ALTER TABLE `contributions` ADD `originalMediaMimeType` varchar(127);--> statement-breakpoint
ALTER TABLE `contributions` ADD `originalMediaOriginalName` varchar(255);--> statement-breakpoint
ALTER TABLE `contributions` ADD `originalMediaSizeBytes` int;--> statement-breakpoint
ALTER TABLE `contributions` ADD `processedMediaKey` varchar(512);--> statement-breakpoint
ALTER TABLE `contributions` ADD `processedMediaUrl` varchar(1024);--> statement-breakpoint
ALTER TABLE `contributions` ADD `processedMediaSizeBytes` int;--> statement-breakpoint
ALTER TABLE `contributions` ADD `thumbnailKey` varchar(512);--> statement-breakpoint
ALTER TABLE `contributions` ADD `thumbnailUrl` varchar(1024);--> statement-breakpoint
ALTER TABLE `contributions` ADD `durationSeconds` int;--> statement-breakpoint
ALTER TABLE `contributions` ADD `quote` varchar(180);--> statement-breakpoint
ALTER TABLE `contributions` ADD `situation` varchar(255);--> statement-breakpoint
ALTER TABLE `contributions` ADD `description` text;--> statement-breakpoint
ALTER TABLE `contributions` ADD `keywords` text;--> statement-breakpoint
ALTER TABLE `contributions` ADD `categoryId` varchar(32);--> statement-breakpoint
ALTER TABLE `contributions` ADD `corner` enum('tr','tl');--> statement-breakpoint
ALTER TABLE `contributions` ADD `sourceName` varchar(255);--> statement-breakpoint
ALTER TABLE `contributions` ADD `sourceUrl` varchar(2048);--> statement-breakpoint
ALTER TABLE `contributions` ADD `rightsStatus` enum('pending','cleared','permission','original','restricted');--> statement-breakpoint
ALTER TABLE `contributions` ADD `rejectionReason` text;--> statement-breakpoint
ALTER TABLE `contributions` ADD `reviewedByUserId` int;--> statement-breakpoint
ALTER TABLE `contributions` ADD `reviewedAt` timestamp;--> statement-breakpoint
ALTER TABLE `contributions` ADD `publishedReactionId` int;--> statement-breakpoint
ALTER TABLE `reactions` ADD `sourceMediaKey` varchar(512);--> statement-breakpoint
ALTER TABLE `reactions` ADD `sourceMediaUrl` varchar(1024);--> statement-breakpoint
ALTER TABLE `reactions` ADD `sourceMediaMimeType` varchar(127);--> statement-breakpoint
ALTER TABLE `reactions` ADD `sourceMediaOriginalName` varchar(255);--> statement-breakpoint
ALTER TABLE `reactions` ADD `sourceMediaSizeBytes` int;--> statement-breakpoint
ALTER TABLE `reactions` ADD `thumbnailKey` varchar(512);--> statement-breakpoint
ALTER TABLE `reactions` ADD `thumbnailUrl` varchar(1024);--> statement-breakpoint
ALTER TABLE `reactions` ADD `processingStatus` enum('pending','processing','ready','failed') DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE `reactions` ADD `processingError` text;--> statement-breakpoint
ALTER TABLE `contributions` ADD CONSTRAINT `contributions_trackingCode_unique` UNIQUE(`trackingCode`);--> statement-breakpoint
ALTER TABLE `auditEvents` ADD CONSTRAINT `auditEvents_actorUserId_users_id_fk` FOREIGN KEY (`actorUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `homePageSettings` ADD CONSTRAINT `homePageSettings_weeklyReactionId_reactions_id_fk` FOREIGN KEY (`weeklyReactionId`) REFERENCES `reactions`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `homePageSettings` ADD CONSTRAINT `homePageSettings_updatedByUserId_users_id_fk` FOREIGN KEY (`updatedByUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `userNotifications` ADD CONSTRAINT `userNotifications_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `userNotifications` ADD CONSTRAINT `userNotifications_contributionId_contributions_id_fk` FOREIGN KEY (`contributionId`) REFERENCES `contributions`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `audit_events_entity_idx` ON `auditEvents` (`entityType`,`entityId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `audit_events_actor_idx` ON `auditEvents` (`actorUserId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `notifications_user_read_idx` ON `userNotifications` (`userId`,`readAt`,`createdAt`);--> statement-breakpoint
ALTER TABLE `contributions` ADD CONSTRAINT `contributions_categoryId_categories_id_fk` FOREIGN KEY (`categoryId`) REFERENCES `categories`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `contributions` ADD CONSTRAINT `contributions_reviewedByUserId_users_id_fk` FOREIGN KEY (`reviewedByUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `contributions` ADD CONSTRAINT `contributions_publishedReactionId_reactions_id_fk` FOREIGN KEY (`publishedReactionId`) REFERENCES `reactions`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `contributions_status_created_idx` ON `contributions` (`status`,`createdAt`);--> statement-breakpoint
CREATE INDEX `contributions_processing_idx` ON `contributions` (`processingStatus`,`updatedAt`);--> statement-breakpoint
CREATE INDEX `reactions_processing_idx` ON `reactions` (`processingStatus`,`updatedAt`);