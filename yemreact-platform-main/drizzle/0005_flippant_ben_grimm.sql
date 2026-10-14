ALTER TABLE `reactions` ADD `searchOptimizer` text;--> statement-breakpoint
ALTER TABLE `reactions` ADD `searchDocument` text;--> statement-breakpoint
ALTER TABLE `reactions` ADD `semanticEmbedding` text;--> statement-breakpoint
ALTER TABLE `reactions` ADD `semanticModel` varchar(96);--> statement-breakpoint
ALTER TABLE `reactions` ADD `semanticIndexedAt` timestamp;--> statement-breakpoint
ALTER TABLE `reactions` ADD `viewCount` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `reactions` ADD `downloadCount` int DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX `reactions_engagement_idx` ON `reactions` (`status`,`viewCount`,`downloadCount`);