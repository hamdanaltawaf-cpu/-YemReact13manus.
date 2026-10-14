CREATE TABLE `reactionShareEvents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`reactionId` int NOT NULL,
	`userId` int,
	`sessionHash` varchar(128) NOT NULL,
	`source` enum('whatsapp','telegram','x','copy') NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `reactionShareEvents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `recentlyViewedReactions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`reactionId` int NOT NULL,
	`viewedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `recentlyViewedReactions_id` PRIMARY KEY(`id`),
	CONSTRAINT `recent_view_user_reaction_unique` UNIQUE(`userId`,`reactionId`)
);
--> statement-breakpoint
CREATE TABLE `saveFolderItems` (
	`id` int AUTO_INCREMENT NOT NULL,
	`folderId` int NOT NULL,
	`reactionId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `saveFolderItems_id` PRIMARY KEY(`id`),
	CONSTRAINT `save_folder_reaction_unique` UNIQUE(`folderId`,`reactionId`)
);
--> statement-breakpoint
CREATE TABLE `saveFolders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(80) NOT NULL,
	`isDefault` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `saveFolders_id` PRIMARY KEY(`id`),
	CONSTRAINT `save_folder_user_name_unique` UNIQUE(`userId`,`name`)
);
--> statement-breakpoint
ALTER TABLE `reactionShareEvents` ADD CONSTRAINT `reactionShareEvents_reactionId_reactions_id_fk` FOREIGN KEY (`reactionId`) REFERENCES `reactions`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `reactionShareEvents` ADD CONSTRAINT `reactionShareEvents_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `recentlyViewedReactions` ADD CONSTRAINT `recentlyViewedReactions_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `recentlyViewedReactions` ADD CONSTRAINT `recentlyViewedReactions_reactionId_reactions_id_fk` FOREIGN KEY (`reactionId`) REFERENCES `reactions`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `saveFolderItems` ADD CONSTRAINT `saveFolderItems_folderId_saveFolders_id_fk` FOREIGN KEY (`folderId`) REFERENCES `saveFolders`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `saveFolderItems` ADD CONSTRAINT `saveFolderItems_reactionId_reactions_id_fk` FOREIGN KEY (`reactionId`) REFERENCES `reactions`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `saveFolders` ADD CONSTRAINT `saveFolders_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `reaction_shares_reaction_created_idx` ON `reactionShareEvents` (`reactionId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `reaction_shares_source_created_idx` ON `reactionShareEvents` (`source`,`createdAt`);--> statement-breakpoint
CREATE INDEX `recent_view_user_time_idx` ON `recentlyViewedReactions` (`userId`,`viewedAt`);--> statement-breakpoint
CREATE INDEX `save_folder_items_reaction_idx` ON `saveFolderItems` (`reactionId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `save_folder_user_idx` ON `saveFolders` (`userId`,`updatedAt`);