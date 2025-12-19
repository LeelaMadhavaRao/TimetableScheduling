// Email templates for timetable admin notifications

export interface AdminCreatedEmailData {
  adminName: string
  username: string
  password: string
  loginUrl: string
}

export interface RequestApprovedEmailData {
  name: string
  username: string
  password: string
  loginUrl: string
}

export interface RequestRejectedEmailData {
  name: string
  reason?: string
}

export interface AdminUpdatedEmailData {
  adminName: string
  username: string
  updatedFields: string[]
  loginUrl: string
}

export function generateAdminCreatedEmail(data: AdminCreatedEmailData): { subject: string; html: string; text: string } {
  const subject = 'Welcome! Your Timetable Administrator Account Has Been Created'
  
  const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #4F46E5; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background-color: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
    .credentials { background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #4F46E5; }
    .button { display: inline-block; background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
    .footer { text-align: center; margin-top: 30px; font-size: 12px; color: #6b7280; }
    .warning { background-color: #fef3c7; padding: 15px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #f59e0b; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎓 Welcome to Timetable Scheduling System</h1>
    </div>
    <div class="content">
      <h2>Hello ${data.adminName},</h2>
      <p>Your Timetable Administrator account has been successfully created by the System Administrator.</p>
      
      <p>You can now access the system to manage timetables, faculty schedules, and class assignments.</p>
      
      <div class="credentials">
        <h3>📧 Your Login Credentials</h3>
        <p><strong>Username:</strong> ${data.username}</p>
        <p><strong>Temporary Password:</strong> ${data.password}</p>
      </div>
      
      <div class="warning">
        <p><strong>⚠️ Important Security Notice:</strong></p>
        <p>Please change your password immediately after your first login for security purposes.</p>
      </div>
      
      <div style="text-align: center;">
        <a href="${data.loginUrl}" class="button">Login to Dashboard</a>
      </div>
      
      <p><strong>What you can do:</strong></p>
      <ul>
        <li>Generate and optimize timetables</li>
        <li>Manage faculty, sections, and subjects</li>
        <li>Assign classrooms and schedules</li>
        <li>View and download timetable reports</li>
      </ul>
      
      <p>If you have any questions or need assistance, please contact the System Administrator.</p>
      
      <p>Best regards,<br>
      <strong>Timetable Scheduling System</strong></p>
    </div>
    <div class="footer">
      <p>This is an automated message. Please do not reply to this email.</p>
      <p>&copy; ${new Date().getFullYear()} Timetable Scheduling System. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
  `
  
  const text = `
Welcome to Timetable Scheduling System!

Hello ${data.adminName},

Your Timetable Administrator account has been successfully created by the System Administrator.

Your Login Credentials:
Username: ${data.username}
Temporary Password: ${data.password}

IMPORTANT: Please change your password immediately after your first login for security purposes.

Login URL: ${data.loginUrl}

What you can do:
- Generate and optimize timetables
- Manage faculty, sections, and subjects  
- Assign classrooms and schedules
- View and download timetable reports

If you have any questions or need assistance, please contact the System Administrator.

Best regards,
Timetable Scheduling System
  `
  
  return { subject, html, text }
}

export function generateRequestApprovedEmail(data: RequestApprovedEmailData): { subject: string; html: string; text: string } {
  const subject = '✅ Your Timetable Administrator Access Request Has Been Approved!'
  
  const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #10b981; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background-color: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
    .credentials { background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #10b981; }
    .button { display: inline-block; background-color: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
    .footer { text-align: center; margin-top: 30px; font-size: 12px; color: #6b7280; }
    .warning { background-color: #fef3c7; padding: 15px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #f59e0b; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎉 Request Approved!</h1>
    </div>
    <div class="content">
      <h2>Congratulations ${data.name}!</h2>
      <p>Your request for Timetable Administrator access has been <strong>approved</strong> by the System Administrator.</p>
      
      <p>Your account is now active and ready to use!</p>
      
      <div class="credentials">
        <h3>📧 Your Login Credentials</h3>
        <p><strong>Username:</strong> ${data.username}</p>
        <p><strong>Password:</strong> ${data.password}</p>
      </div>
      
      <div class="warning">
        <p><strong>⚠️ Important Security Notice:</strong></p>
        <p>Please change your password immediately after your first login for security purposes.</p>
      </div>
      
      <div style="text-align: center;">
        <a href="${data.loginUrl}" class="button">Login Now</a>
      </div>
      
      <p><strong>Your Responsibilities:</strong></p>
      <ul>
        <li>Create and manage timetables efficiently</li>
        <li>Ensure accurate faculty and classroom assignments</li>
        <li>Maintain data integrity in the system</li>
        <li>Coordinate with faculty for schedule conflicts</li>
      </ul>
      
      <p>Thank you for joining our team!</p>
      
      <p>Best regards,<br>
      <strong>Timetable Scheduling System</strong></p>
    </div>
    <div class="footer">
      <p>This is an automated message. Please do not reply to this email.</p>
      <p>&copy; ${new Date().getFullYear()} Timetable Scheduling System. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
  `
  
  const text = `
Request Approved!

Congratulations ${data.name}!

Your request for Timetable Administrator access has been approved by the System Administrator.

Your Login Credentials:
Username: ${data.username}
Password: ${data.password}

IMPORTANT: Please change your password immediately after your first login for security purposes.

Login URL: ${data.loginUrl}

Your Responsibilities:
- Create and manage timetables efficiently
- Ensure accurate faculty and classroom assignments  
- Maintain data integrity in the system
- Coordinate with faculty for schedule conflicts

Thank you for joining our team!

Best regards,
Timetable Scheduling System
  `
  
  return { subject, html, text }
}

export function generateRequestRejectedEmail(data: RequestRejectedEmailData): { subject: string; html: string; text: string } {
  const subject = 'Update on Your Timetable Administrator Access Request'
  
  const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #ef4444; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background-color: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
    .reason { background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ef4444; }
    .footer { text-align: center; margin-top: 30px; font-size: 12px; color: #6b7280; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Request Status Update</h1>
    </div>
    <div class="content">
      <h2>Dear ${data.name},</h2>
      <p>Thank you for your interest in becoming a Timetable Administrator.</p>
      
      <p>After careful review, we regret to inform you that your access request has not been approved at this time.</p>
      
      ${data.reason ? `
      <div class="reason">
        <h3>📝 Reason:</h3>
        <p>${data.reason}</p>
      </div>
      ` : ''}
      
      <p><strong>What's Next?</strong></p>
      <ul>
        <li>You may reapply after addressing the concerns mentioned above</li>
        <li>Contact the System Administrator for more information</li>
        <li>Ensure you meet all the requirements for the Timetable Administrator role</li>
      </ul>
      
      <p>We appreciate your understanding and interest in contributing to our timetable management system.</p>
      
      <p>Best regards,<br>
      <strong>Timetable Scheduling System</strong></p>
    </div>
    <div class="footer">
      <p>This is an automated message. Please do not reply to this email.</p>
      <p>&copy; ${new Date().getFullYear()} Timetable Scheduling System. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
  `
  
  const text = `
Request Status Update

Dear ${data.name},

Thank you for your interest in becoming a Timetable Administrator.

After careful review, we regret to inform you that your access request has not been approved at this time.

${data.reason ? `Reason: ${data.reason}\n` : ''}

What's Next?
- You may reapply after addressing the concerns mentioned above
- Contact the System Administrator for more information
- Ensure you meet all the requirements for the Timetable Administrator role

We appreciate your understanding and interest in contributing to our timetable management system.

Best regards,
Timetable Scheduling System
  `
  
  return { subject, html, text }
}

export function generateAdminUpdatedEmail(data: AdminUpdatedEmailData): { subject: string; html: string; text: string } {
  const subject = 'Your Timetable Administrator Account Has Been Updated'
  
  const fieldsUpdatedList = data.updatedFields.join(', ')
  
  const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #10b981; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background-color: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
    .update-box { background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #10b981; }
    .button { display: inline-block; background-color: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
    .footer { text-align: center; margin-top: 30px; font-size: 12px; color: #6b7280; }
    .info { background-color: #dbeafe; padding: 15px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #3b82f6; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🔄 Account Information Updated</h1>
    </div>
    <div class="content">
      <h2>Hello ${data.adminName},</h2>
      <p>Your Timetable Administrator account details have been updated by the System Administrator.</p>
      
      <div class="update-box">
        <h3>📝 Updated Information</h3>
        <p>The following details were modified:</p>
        <ul>
          ${data.updatedFields.map(field => `<li><strong>${field}</strong></li>`).join('')}
        </ul>
      </div>
      
      ${data.updatedFields.includes('Password') ? `
      <div class="info">
        <p><strong>🔑 Password Changed:</strong></p>
        <p>Your password has been updated. If you did not request this change, please contact the System Administrator immediately.</p>
      </div>
      ` : ''}
      
      <div style="text-align: center;">
        <a href="${data.loginUrl}" class="button">Login to Dashboard</a>
      </div>
      
      <p><strong>Your Username:</strong> ${data.username}</p>
      
      <p>If you have any questions about these changes or did not expect this update, please contact the System Administrator.</p>
      
      <p>Best regards,<br>
      <strong>Timetable Scheduling System</strong></p>
    </div>
    <div class="footer">
      <p>This is an automated message. Please do not reply to this email.</p>
      <p>&copy; ${new Date().getFullYear()} Timetable Scheduling System. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
  `
  
  const text = `
Account Information Updated

Hello ${data.adminName},

Your Timetable Administrator account details have been updated by the System Administrator.

Updated Information:
${data.updatedFields.map(field => `- ${field}`).join('\n')}

Your Username: ${data.username}

${data.updatedFields.includes('Password') ? `
PASSWORD CHANGED:
Your password has been updated. If you did not request this change, please contact the System Administrator immediately.
` : ''}

Login URL: ${data.loginUrl}

If you have any questions about these changes or did not expect this update, please contact the System Administrator.

Best regards,
Timetable Scheduling System
  `
  
  return { subject, html, text }
}

