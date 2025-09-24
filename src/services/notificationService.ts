// Notification Service for Email, SMS, and Push Notifications
import nodemailer from "nodemailer";
import { config } from "../config/env";
import { db } from "../config/firebase";
import { enhancedLogger } from "../utils/enhancedLogger";

interface EmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  attachments?: Array<{
    filename: string;
    content: Buffer | string;
    contentType?: string;
  }>;
}

interface SMSOptions {
  to: string;
  message: string;
}

interface PushNotificationOptions {
  userId: string;
  title: string;
  body: string;
  data?: Record<string, any>;
  icon?: string;
  badge?: string;
}

interface NotificationPreferences {
  userId: string;
  email: {
    enabled: boolean;
    orderUpdates: boolean;
    stockAlerts: boolean;
    marketing: boolean;
    systemNotifications: boolean;
  };
  sms: {
    enabled: boolean;
    orderUpdates: boolean;
    stockAlerts: boolean;
    criticalAlerts: boolean;
  };
  push: {
    enabled: boolean;
    orderUpdates: boolean;
    stockAlerts: boolean;
    marketing: boolean;
    systemNotifications: boolean;
  };
}

class NotificationService {
  private emailTransporter: nodemailer.Transporter | null = null;
  private notificationPrefsCollection = db.collection(
    "notification_preferences"
  );
  private notificationLogsCollection = db.collection("notification_logs");

  constructor() {
    this.initializeEmailTransporter();
  }

  private initializeEmailTransporter() {
    try {
      if (config.email?.host && config.email?.user && config.email?.password) {
        this.emailTransporter = nodemailer.createTransport({
          host: config.email.host,
          port: config.email.port || 587,
          secure: config.email.secure || false,
          auth: {
            user: config.email.user,
            pass: config.email.password,
          },
          tls: {
            rejectUnauthorized: false,
          },
        });

        // Verify connection
        this.emailTransporter.verify((error, success) => {
          if (error) {
            enhancedLogger.error(
              "Email transporter verification failed",
              {},
              error
            );
          } else {
            enhancedLogger.info("Email transporter ready", {}, { success });
          }
        });
      } else {
        enhancedLogger.warn(
          "Email configuration incomplete",
          {},
          {
            hasHost: !!config.email?.host,
            hasUser: !!config.email?.user,
            hasPassword: !!config.email?.password,
          }
        );
      }
    } catch (error) {
      enhancedLogger.error(
        "Failed to initialize email transporter",
        {},
        error as Error
      );
    }
  }

  // Send email notification
  async sendEmail(options: EmailOptions): Promise<boolean> {
    try {
      if (!this.emailTransporter) {
        throw new Error("Email transporter not initialized");
      }

      const mailOptions = {
        from: `"${config.email?.fromName || "Grub Distributor"}" <${
          config.email?.from || config.email?.user
        }>`,
        to: Array.isArray(options.to) ? options.to.join(", ") : options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
        attachments: options.attachments,
      };

      const result = await this.emailTransporter.sendMail(mailOptions);

      // Log successful email
      await this.logNotification({
        type: "email",
        recipient: Array.isArray(options.to) ? options.to[0] : options.to,
        subject: options.subject,
        status: "sent",
        messageId: result.messageId,
        sentAt: new Date(),
      });

      enhancedLogger.info(
        "Email sent successfully",
        {},
        {
          to: options.to,
          subject: options.subject,
          messageId: result.messageId,
        }
      );

      return true;
    } catch (error) {
      enhancedLogger.error("Failed to send email", {}, error as Error);

      // Log failed email
      await this.logNotification({
        type: "email",
        recipient: Array.isArray(options.to) ? options.to[0] : options.to,
        subject: options.subject,
        status: "failed",
        error: (error as Error).message,
        sentAt: new Date(),
      });

      return false;
    }
  }

  // Send SMS notification (placeholder for SMS service integration)
  async sendSMS(options: SMSOptions): Promise<boolean> {
    try {
      // TODO: Integrate with SMS service (Twilio, AWS SNS, etc.)
      console.log(`SMS to ${options.to}: ${options.message}`);

      // Log SMS attempt
      await this.logNotification({
        type: "sms",
        recipient: options.to,
        message: options.message,
        status: "sent", // Would be actual status from SMS service
        sentAt: new Date(),
      });

      enhancedLogger.info(
        "SMS sent successfully",
        {},
        {
          to: options.to,
          message: options.message.substring(0, 50) + "...",
        }
      );

      return true;
    } catch (error) {
      enhancedLogger.error("Failed to send SMS", {}, error as Error);

      await this.logNotification({
        type: "sms",
        recipient: options.to,
        message: options.message,
        status: "failed",
        error: (error as Error).message,
        sentAt: new Date(),
      });

      return false;
    }
  }

  // Send push notification (placeholder for push service integration)
  async sendPushNotification(
    options: PushNotificationOptions
  ): Promise<boolean> {
    try {
      // TODO: Integrate with push notification service (Firebase FCM, OneSignal, etc.)
      console.log(
        `Push notification to user ${options.userId}: ${options.title}`
      );

      // Log push notification attempt
      await this.logNotification({
        type: "push",
        recipient: options.userId,
        title: options.title,
        message: options.body,
        status: "sent",
        sentAt: new Date(),
      });

      enhancedLogger.info(
        "Push notification sent successfully",
        {},
        {
          userId: options.userId,
          title: options.title,
        }
      );

      return true;
    } catch (error) {
      enhancedLogger.error(
        "Failed to send push notification",
        {},
        error as Error
      );

      await this.logNotification({
        type: "push",
        recipient: options.userId,
        title: options.title,
        message: options.body,
        status: "failed",
        error: (error as Error).message,
        sentAt: new Date(),
      });

      return false;
    }
  }

  // Get user notification preferences
  async getUserNotificationPreferences(
    userId: string
  ): Promise<NotificationPreferences | null> {
    try {
      const prefsDoc = await this.notificationPrefsCollection.doc(userId).get();

      if (!prefsDoc.exists) {
        // Return default preferences
        return {
          userId,
          email: {
            enabled: true,
            orderUpdates: true,
            stockAlerts: true,
            marketing: false,
            systemNotifications: true,
          },
          sms: {
            enabled: false,
            orderUpdates: false,
            stockAlerts: true,
            criticalAlerts: true,
          },
          push: {
            enabled: true,
            orderUpdates: true,
            stockAlerts: true,
            marketing: false,
            systemNotifications: true,
          },
        };
      }

      return prefsDoc.data() as NotificationPreferences;
    } catch (error) {
      enhancedLogger.error(
        "Failed to get user notification preferences",
        {},
        error as Error
      );
      return null;
    }
  }

  // Update user notification preferences
  async updateUserNotificationPreferences(
    userId: string,
    preferences: Partial<NotificationPreferences>
  ): Promise<boolean> {
    try {
      await this.notificationPrefsCollection.doc(userId).set(
        {
          userId,
          ...preferences,
          updatedAt: new Date(),
        },
        { merge: true }
      );

      enhancedLogger.info(
        "User notification preferences updated",
        {},
        {
          userId,
          preferences,
        }
      );

      return true;
    } catch (error) {
      enhancedLogger.error(
        "Failed to update user notification preferences",
        {},
        error as Error
      );
      return false;
    }
  }

  // Send stock alert notifications to relevant users
  async sendStockAlertNotifications(
    productId: string,
    productName: string,
    currentStock: number,
    alertType: "low_stock" | "out_of_stock" | "critical",
    severity: "low" | "medium" | "high" | "critical"
  ): Promise<void> {
    try {
      // Get users who should receive stock alerts
      const usersSnapshot = await db
        .collection("users")
        .where("role", "in", ["admin", "owner", "staff"])
        .where("isActive", "==", true)
        .get();

      const notificationPromises = usersSnapshot.docs.map(async (userDoc) => {
        const user = userDoc.data();
        const preferences = await this.getUserNotificationPreferences(user.id);

        if (!preferences) return;

        const subject = `Stock Alert: ${productName}`;
        const message = `${productName} is ${alertType.replace(
          "_",
          " "
        )}. Current stock: ${currentStock}`;

        // Send email if enabled
        if (preferences.email.enabled && preferences.email.stockAlerts) {
          await this.sendEmail({
            to: user.email,
            subject,
            html: this.generateStockAlertEmailTemplate(
              productName,
              currentStock,
              alertType,
              severity
            ),
            text: message,
          });
        }

        // Send SMS for critical alerts if enabled
        if (
          preferences.sms.enabled &&
          (preferences.sms.stockAlerts ||
            (severity === "critical" && preferences.sms.criticalAlerts))
        ) {
          if (user.phoneNumber) {
            await this.sendSMS({
              to: user.phoneNumber,
              message,
            });
          }
        }

        // Send push notification if enabled
        if (preferences.push.enabled && preferences.push.stockAlerts) {
          await this.sendPushNotification({
            userId: user.id,
            title: subject,
            body: message,
            data: {
              type: "stock_alert",
              productId,
              alertType,
              severity,
            },
          });
        }
      });

      await Promise.all(notificationPromises);
    } catch (error) {
      enhancedLogger.error(
        "Failed to send stock alert notifications",
        {},
        error as Error
      );
    }
  }

  // Generate email template for stock alerts
  private generateStockAlertEmailTemplate(
    productName: string,
    currentStock: number,
    alertType: string,
    severity: string
  ): string {
    const severityColor =
      {
        low: "#fbbf24",
        medium: "#f59e0b",
        high: "#ef4444",
        critical: "#dc2626",
      }[severity] || "#6b7280";

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Stock Alert</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: ${severityColor}; color: white; padding: 15px; border-radius: 5px; margin-bottom: 20px;">
              <h2 style="margin: 0;">Stock Alert - ${severity.toUpperCase()}</h2>
            </div>
            
            <div style="background: #f9f9f9; padding: 20px; border-radius: 5px; margin-bottom: 20px;">
              <h3 style="margin-top: 0;">Product: ${productName}</h3>
              <p><strong>Alert Type:</strong> ${alertType
                .replace("_", " ")
                .toUpperCase()}</p>
              <p><strong>Current Stock:</strong> ${currentStock} units</p>
              <p><strong>Severity:</strong> ${severity.toUpperCase()}</p>
              <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
            </div>
            
            <div style="background: #e3f2fd; padding: 15px; border-radius: 5px; border-left: 4px solid #2196f3;">
              <p style="margin: 0;"><strong>Action Required:</strong> Please review inventory levels and consider restocking this product.</p>
            </div>
            
            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #666;">
              <p>This is an automated notification from Grub Distributor System.</p>
            </div>
          </div>
        </body>
      </html>
    `;
  }

  // Log notification for audit trail
  private async logNotification(logData: any): Promise<void> {
    try {
      await this.notificationLogsCollection.add({
        ...logData,
        createdAt: new Date(),
      });
    } catch (error) {
      enhancedLogger.error("Failed to log notification", {}, error as Error);
    }
  }
}

export const notificationService = new NotificationService();
