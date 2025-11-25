import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export async function POST(request: Request) {
    try {
        const { message, email, type } = await request.json();

        if (!message) {
            return NextResponse.json(
                { error: 'Message is required' },
                { status: 400 }
            );
        }

        // Check if SMTP configuration is present
        const smtpConfigured =
            process.env.SMTP_HOST &&
            process.env.SMTP_USER &&
            process.env.SMTP_PASS;

        if (smtpConfigured) {
            const transporter = nodemailer.createTransport({
                host: process.env.SMTP_HOST,
                port: Number(process.env.SMTP_PORT) || 587,
                secure: Boolean(process.env.SMTP_SECURE) || false, // true for 465, false for other ports
                auth: {
                    user: process.env.SMTP_USER,
                    pass: process.env.SMTP_PASS,
                },
            });

            const mailOptions = {
                from: process.env.FEEDBACK_FROM_EMAIL || process.env.SMTP_USER,
                to: process.env.FEEDBACK_TO_EMAIL || process.env.SMTP_USER, // Default to sending to self if not specified
                subject: `[SEO Tools Feedback] ${type || 'General'}`,
                text: `
Type: ${type || 'General'}
From: ${email || 'Anonymous'}

Message:
${message}
        `,
                html: `
<h3>New Feedback Received</h3>
<p><strong>Type:</strong> ${type || 'General'}</p>
<p><strong>From:</strong> ${email || 'Anonymous'}</p>
<hr />
<p><strong>Message:</strong></p>
<pre style="font-family: sans-serif; white-space: pre-wrap;">${message}</pre>
        `,
            };

            await transporter.sendMail(mailOptions);
            console.log('Feedback email sent successfully');
        } else {
            // Fallback: Log to console if no SMTP config
            console.log('----------------------------------------');
            console.log('FEEDBACK RECEIVED (No SMTP Configured):');
            console.log(`Type: ${type}`);
            console.log(`From: ${email}`);
            console.log(`Message: ${message}`);
            console.log('----------------------------------------');
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error processing feedback:', error);
        return NextResponse.json(
            { error: 'Failed to process feedback' },
            { status: 500 }
        );
    }
}
