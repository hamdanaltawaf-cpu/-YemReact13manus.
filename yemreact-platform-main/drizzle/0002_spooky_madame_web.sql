ALTER TABLE `reactions` ADD `mediaStatus` enum('missing','uploaded') DEFAULT 'missing' NOT NULL;--> statement-breakpoint
ALTER TABLE `reactions` ADD `mediaKey` varchar(512);--> statement-breakpoint
ALTER TABLE `reactions` ADD `mediaUrl` varchar(1024);--> statement-breakpoint
ALTER TABLE `reactions` ADD `mediaMimeType` varchar(127);--> statement-breakpoint
ALTER TABLE `reactions` ADD `mediaOriginalName` varchar(255);--> statement-breakpoint
ALTER TABLE `reactions` ADD `mediaSizeBytes` int;--> statement-breakpoint
ALTER TABLE `reactions` ADD `mediaUploadedAt` timestamp;