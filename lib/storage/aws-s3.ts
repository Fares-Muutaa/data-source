import { S3Client, PutObjectCommand, CreateMultipartUploadCommand,
  UploadPartCommand, CompleteMultipartUploadCommand, AbortMultipartUploadCommand } from "@aws-sdk/client-s3";
import { Readable } from 'stream';
// AWS S3 Storage Service Implementation

export interface S3Config {
  accessKeyId: string
  secretAccessKey: string
  region: string
  bucketName: string
}

// Helper function to convert Blob/File to Readable stream
function blobToReadable(blob: Blob): Readable {
  const reader = blob.stream().getReader();
  return new Readable({
    async read() {
      const { done, value } = await reader.read();
      if (done) {
        this.push(null);
      } else {
        this.push(Buffer.from(value));
      }
    }
  });
}

export class S3StorageService {
  private readonly config: S3Config

  constructor(config: S3Config) {
    this.config = config
  }


  async uploadLargeFile(file: File, filePath: string): Promise<any> {

    console.log("upload Large File started!");
    const s3Client = new S3Client({
      region: this.config.region,
      credentials: {
        accessKeyId: this.config.accessKeyId,
        secretAccessKey: this.config.secretAccessKey,
      },
      requestHandler: {
        requestTimeout: 20 * 60 * 1000, // 10 minutes
      },
      maxAttempts: 5, // Retry up to 5 times
    });
    // 1. Initiate multipart upload
    const createUploadResponse = await s3Client.send(
        new CreateMultipartUploadCommand({
          Bucket: this.config.bucketName,
          Key: filePath,
          ContentType: file.type,
        })
    );
    const uploadId = createUploadResponse.UploadId;

    try {
      const partSize = 10 * 1024 * 1024; // 10MB chunks
      const parts = [];
      let partNumber = 1;

      // 2. Upload parts
      for (let start = 0; start < file.size; start += partSize) {
        const end = Math.min(start + partSize, file.size);
        const chunk = file.slice(start, end);
  
        const chunkData: any = await (async () => {
          if (typeof window === 'undefined') {
            // Environnement Node.js
            const buffer = Buffer.from(await chunk.arrayBuffer());
            return buffer;
          } else {
            // Environnement navigateur
            return await chunk.arrayBuffer();
          }
        })();
        const uploadPartResponse: any = await s3Client.send(
            new UploadPartCommand({
              Bucket: this.config.bucketName,
              Key: filePath,
              UploadId: uploadId!,
              PartNumber: partNumber,
              // Body: body,
              Body: chunkData,
              ContentLength: end - start,
            })
        );

        parts.push({
          PartNumber: partNumber,
          ETag: uploadPartResponse.ETag,
        });

        partNumber++;
      }

      // 3. Complete upload
      await s3Client.send(
          new CompleteMultipartUploadCommand({
            Bucket: this.config.bucketName,
            Key: filePath,
            UploadId: uploadId,
            MultipartUpload: { Parts: parts },
          })
      );
      // Generate public URL (adjust based on your bucket configuration)
      const publicUrl = `https://${this.config.bucketName}.s3.${this.config.region}.amazonaws.com/${filePath}`;

      console.log("upload large file completed !");
      return {
        url: publicUrl,
        pathname: filePath,
        size: file.size,
      };

    } catch (error) {
      // Handle error and potentially abort upload
      console.error('Upload failed:', error);

      if (uploadId) {
        try {
          await s3Client.send(new AbortMultipartUploadCommand({
            Bucket: this.config.bucketName,
            Key: filePath,
            UploadId: uploadId,
          }));
        } catch (abortError) {
          console.error('Error aborting upload:', abortError);
        }
      }
      throw error;
    }
  }
  async uploadFile(file: File, filePath: string): Promise<{ url: string; pathname: string; size: number }> {
    try {
      // In a real implementation, you would use the AWS SDK
      // For this demo, we'll simulate the upload
      const formData = new FormData()
      formData.append("file", file)
      formData.append("key", filePath)
      formData.append("bucket", this.config.bucketName)

      if(!file || !filePath) {
        throw new Error("File or file path is missing")
      }
      console.log("Uploading file to S3 with path:", filePath);
      // console.log("config details : ", this.config)
      const s3Client = new S3Client({
        region: this.config.region,
        credentials: {
          accessKeyId: this.config.accessKeyId,
          secretAccessKey: this.config.secretAccessKey,
        },
        requestHandler: {
          requestTimeout: 20 * 60 * 1000, // 10 minutes
        },
        maxAttempts: 5, // Retry up to 5 times
      });


      // Convert the file to a buffer
      const fileBuffer = Buffer.from(await file.arrayBuffer());

      const uploadParams: any = {
        Bucket: this.config.bucketName,
        Key: filePath,
        Body: fileBuffer,
        ContentType: file.type || "application/octet-stream",

      };

      // Simulate AWS S3 upload with timeout
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 30000) // 3 second timeout

      try {
        // Upload the file to S3
        console.log("Sending PutObjectCommand to S3...");
        await s3Client.send(new PutObjectCommand(uploadParams), {
          abortSignal: controller.signal
        });

        clearTimeout(timeoutId)

        const publicUrl = `https://${this.config.bucketName}.s3.${this.config.region}.amazonaws.com/${filePath}`;

        // If you need a pre-signed URL instead (for private buckets):
        // const signedUrl = await getSignedUrl(s3Client, new GetObjectCommand({
        //   Bucket: this.config.bucketName,
        //   Key: filePath,
        // }), { expiresIn: 3600 });

        return {
          url: publicUrl,
          pathname: filePath,
          size: file.size,
        };
      } catch (error: any) {
        clearTimeout(timeoutId)
        if (error.name === "AbortError") {
          throw new Error("S3 upload timeout - please try again")
        }
        throw error
      }
    } catch (error: any) {
      console.error("S3 upload error : ", error)
      throw new Error(`S3 upload failed : ${error.message}`)
    }
  }


  async deleteFile(pathname: string): Promise<void> {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 10000) // 10 second timeout

      const response = await fetch("/api/storage/s3/delete", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: pathname,
          bucket: this.config.bucketName,
        }),
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        throw new Error(`S3 delete failed: ${response.statusText}`)
      }
    } catch (error: any) {
      if (error.name === "AbortError") {
        throw new Error("S3 delete timeout - please try again")
      }
      throw new Error(`S3 delete failed: ${error.message}`)
    }
  }

  async listFiles(prefix?: string): Promise<any[]> {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 15000) // 15 second timeout

      const response = await fetch(`/api/storage/s3/list?prefix=${prefix || ""}&bucket=${this.config.bucketName}`, {
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        throw new Error(`S3 list failed: ${response.statusText}`)
      }

      const result = await response.json()
      return result.files || []
    } catch (error: any) {
      if (error.name === "AbortError") {
        throw new Error("S3 list timeout - please try again")
      }
      throw new Error(`S3 list failed: ${error.message}`)
    }
  }

  async uploadFileSimulate(file: File, filePath: string): Promise<{ url: string; pathname: string; size: number }> {
    try {
      // In a real implementation, you would use the AWS SDK
      // For this demo, we'll simulate the upload
      const formData = new FormData()
      formData.append("file", file)
      formData.append("key", filePath)
      formData.append("bucket", this.config.bucketName)

      if(!file || !filePath) {
        throw new Error("File or file path is missing")
      }

      // Simulate AWS S3 upload with timeout
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 30000) // 30 second timeout

      try {
        // This would be replaced with actual AWS SDK call
        const response = await fetch("/api/storage/s3/upload", {
          method: "POST",
          body: formData,
          signal: controller.signal,
        })

        clearTimeout(timeoutId)

        if (!response.ok) {
          throw new Error(`S3 upload failed: ${response.statusText}`)
        }


        return {
          url: `https://${this.config.bucketName}.s3.${this.config.region}.amazonaws.com/${filePath}`,
          pathname: filePath,
          size: file.size,
        }
      } catch (error: any) {
        clearTimeout(timeoutId)
        if (error.name === "AbortError") {
          throw new Error("S3 upload timeout - please try again")
        }
        throw error
      }
    } catch (error: any) {
      console.error("S3 upload error : ", error)
      throw new Error(`S3 upload failed : ${error.message}`)
    }
  }

}



export const AWS_S3_REGIONS = [
  { name: "US East (N. Virginia)", code: "us-east-1" },
  { name: "US East (Ohio)", code: "us-east-2" },
  { name: "US West (N. California)", code: "us-west-1" },
  { name: "US West (Oregon)", code: "us-west-2" },
  { name: "Africa (Cape Town)", code: "af-south-1" },
  { name: "Asia Pacific (Hong Kong)", code: "ap-east-1" },
  { name: "Asia Pacific (Hyderabad)", code: "ap-south-2" },
  { name: "Asia Pacific (Jakarta)", code: "ap-southeast-3" },
  { name: "Asia Pacific (Melbourne)", code: "ap-southeast-4" },
  { name: "Asia Pacific (Mumbai)", code: "ap-south-1" },
  { name: "Asia Pacific (Osaka)", code: "ap-northeast-3" },
  { name: "Asia Pacific (Seoul)", code: "ap-northeast-2" },
  { name: "Asia Pacific (Singapore)", code: "ap-southeast-1" },
  { name: "Asia Pacific (Sydney)", code: "ap-southeast-2" },
  { name: "Asia Pacific (Tokyo)", code: "ap-northeast-1" },
  { name: "Canada (Central)", code: "ca-central-1" },
  { name: "China (Beijing)", code: "cn-north-1" },
  { name: "China (Ningxia)", code: "cn-northwest-1" },
  { name: "Europe (Frankfurt)", code: "eu-central-1" },
  { name: "Europe (Ireland)", code: "eu-west-1" },
  { name: "Europe (London)", code: "eu-west-2" },
  { name: "Europe (Milan)", code: "eu-south-1" },
  { name: "Europe (Paris)", code: "eu-west-3" },
  { name: "Europe (Spain)", code: "eu-south-2" },
  { name: "Europe (Stockholm)", code: "eu-north-1" },
  { name: "Israel (Tel Aviv)", code: "il-central-1" },
  { name: "Middle East (Bahrain)", code: "me-south-1" },
  { name: "Middle East (UAE)", code: "me-central-1" },
  { name: "South America (São Paulo)", code: "sa-east-1" },
] as const;

// Optional: type for region code
export type AwsS3RegionCode = typeof AWS_S3_REGIONS[number]["code"];
