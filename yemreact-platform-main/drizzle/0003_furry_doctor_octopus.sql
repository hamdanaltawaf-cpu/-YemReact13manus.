CREATE TABLE `contributions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`note` text,
	`status` enum('pending','reviewing','approved','rejected') NOT NULL DEFAULT 'pending',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `contributions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `reactionSaves` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`reactionId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `reactionSaves_id` PRIMARY KEY(`id`),
	CONSTRAINT `user_reaction_save_unique` UNIQUE(`userId`,`reactionId`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `googleSub` varchar(255);--> statement-breakpoint
ALTER TABLE `users` ADD `emailVerified` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_googleSub_unique` UNIQUE(`googleSub`);--> statement-breakpoint
ALTER TABLE `contributions` ADD CONSTRAINT `contributions_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `reactionSaves` ADD CONSTRAINT `reactionSaves_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `reactionSaves` ADD CONSTRAINT `reactionSaves_reactionId_reactions_id_fk` FOREIGN KEY (`reactionId`) REFERENCES `reactions`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `contributions_user_idx` ON `contributions` (`userId`,`status`);--> statement-breakpoint
CREATE INDEX `reaction_saves_user_idx` ON `reactionSaves` (`userId`);