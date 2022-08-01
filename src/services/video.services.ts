import { Video } from "~/models/video.model";
import { Request, Response } from "express";
import { UploadedFile } from "express-fileupload";
import fs from "fs";
import * as error from "~/errors/errors";
import { Op } from "sequelize";
import log4js from "log4js";
import ffmpeg, { FfprobeData } from "fluent-ffmpeg";
if (process.env.FFMPEG_PATH) ffmpeg.setFfmpegPath(process.env.FFMPEG_PATH);
if (process.env.FFPROBE_PATH) ffmpeg.setFfprobePath(process.env.FFPROBE_PATH);

export async function createVideo(fields: {
   source: string;
   user: number;
   duration?: number;
}) {
   return await Video.create({
      source: fields.source,
      user: fields.user,
      duration: fields.duration,
   });
}

export async function updateVideo(
   video: Video,
   fields: {
      [key: string]: any;
   }
) {
   return await video.update({
      ...fields,
   });
}

export async function getVideos(fields: {
   name: string;
   user: number;
   duration: number;
   page: number;
   perPage: number;
}) {
   const { name, user, duration, page, perPage } = fields;

   /* Filter builder. */
   let filter: { [key: string]: any } = {};
   if (name)
      filter.source = {
         [Op.iLike]: `%${name}%`,
      };
   if (user) filter.user = user;
   if (duration) filter.duration = { [Op.gt]: duration };

   return await Video.findAndCountAll({
      where: {
         [Op.and]: {
            ...filter,
         },
      },
      limit: perPage,
      offset: perPage * (page - 1),
   });
}

export async function getVideoById(id: string) {
   return await Video.findByPk(id);
}

export async function getVideosByUserId(
   userId: string,
   page: number,
   perPage: number
) {
   return await Video.findAndCountAll({
      where: {
         user: userId,
      },
      limit: perPage,
      offset: perPage * (page - 1),
   });
}

export async function getVideoMetadata(
   videoPath: string
): Promise<FfprobeData> {
   return await new Promise((resolve, reject) => {
      ffmpeg.ffprobe(videoPath, (err, metadata) => {
         if (err) reject(err);
         resolve(metadata);
      });
   });
}

export function generateVideoPath(videoFolder: string, req: Request): string {
   const file = req.files?.source as UploadedFile;
   return `${videoFolder}/${Date.now()}_${req.body.name}.${file.name
      .split(".")
      .pop()}`;
}

export function getVideoName(video: Video): string | undefined {
   return video.source.split("/").pop()?.split("_").slice(1).join("_");
}

export function generateEncodedVideoFolderPath(
   video: Video,
   resolution: number
): string {
   const outputPath = video.source.split("/").slice(0, -1).join("/");

   return `${outputPath}/${video.id}/${resolution}p/`;
}

export function generateEncodedVideoPath(
   folder: string,
   fileName: string
): string {
   return folder + Date.now() + "_" + fileName;
}

export function createVideoFolder(videoFolder: string, res: Response) {
   fs.mkdir(
      videoFolder,
      {
         recursive: true,
      },
      (err) => {
         if (err)
            return error.badRequest(res, [err.name + " : " + err.message]);
      }
   );
}

export async function encodeVideo(
   videoPath: string,
   outputPath: string,
   resolution: 1080 | 720 | 480 | 360 | 240 | 144
) {
   const logger = log4js.getLogger(
      "- " + resolution + "p encoding : " + videoPath.split("/").pop()
   );
   logger.level = "trace";

   return await new Promise<void>((resolve, reject): void => {
      ffmpeg(videoPath)
         .output(outputPath)
         .size(`?x${resolution}`)
         .on("error", (err) => {
            logger.error(err);
            reject(err);
         })
         .on("end", () => {
            logger.info("Finished processing");
            resolve();
         })
         .on("progress", (progress) => {
            logger.trace("Processing: " + progress.percent + "% done");
         })
         .run();
   });
}
