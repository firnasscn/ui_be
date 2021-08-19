require("dotenv").config();

const nodemailer = require('nodemailer'),
    smtpTransport = require('nodemailer-smtp-transport'),
    _ = require('lodash'),
    fs = require('fs'),
    path = require('path'),

    mailgun = require('mailgun-js')({ apiKey: process.env.MAILGUN_API_KEY, domain: process.env.MAILGUN_DOMAIN });
const handlebars = require('handlebars');

class mail {
    authenticationEmail(userDoc) {

        let mailOptions = {
            from: process.env.ADMIN_EMAIL,
            to: userDoc.email,
            subject: `doodleflow.io | ${userDoc.mailType}`,
            template: 'email-verification',
            'h:X-Mailgun-Variables': JSON.stringify({
                url: userDoc.link
            })

        };
        this.send(mailOptions, false);
    };
    approveMail(userDoc) {

        let mailOptions = {
            from: process.env.ADMIN_EMAIL,
            to: userDoc.email,
            subject: `doodleflow.io | Sign up your doodleflow account`,
            template: 'approval-mail',
            'h:X-Mailgun-Variables': JSON.stringify({
                user: userDoc.email
            })

        };
        this.send(mailOptions, false);
    };
    forgotPassword(userDoc) {
        let mailOptions = {
            from: process.env.ADMIN_EMAIL,
            to: userDoc.email,
            subject: `doodleflow.io | ${userDoc.mailType}`,
            template: 'forgot-password-plain',
            'h:X-Mailgun-Variables': JSON.stringify({ url: userDoc.link })

        };

        this.send(mailOptions, false);

    }

    welcomeInvitation(userDoc) {
        let mailOptions = {
            from: process.env.ADMIN_EMAIL,
            to: userDoc.email,
            subject: `doodleflow.io`,
            template: 'waitlist-template'
        };
        this.send(mailOptions, false);
    }

    invitationEmail(userDoc) {
        let mailOptions = {
            from: process.env.ADMIN_EMAIL,
            to: userDoc.email,
            subject: `doodleflow.io | ${userDoc.userName} has invited you to the focus group ${userDoc.groupName}`,
            template: 'focusgroup-invite-template',
            'h:X-Mailgun-Variables': JSON.stringify({
                userName: userDoc.userName,
                url: userDoc.link,
                groupName: userDoc.groupName
            })

        };

        this.send(mailOptions, false);
    };
    testingInvitationEmail(userDoc) {
        let mailOptions = {
            from: process.env.ADMIN_EMAIL,
            to: userDoc.email,
            subject: `doodleflow.io | ${userDoc.userName} has invited you to join the A/B test ${userDoc.groupName} `,
            template: 'abtesting-invite-template',
            'h:X-Mailgun-Variables': JSON.stringify({
                userName: userDoc.userName,
                url: userDoc.link,
                groupName: userDoc.groupName
            })
        };
        this.send(mailOptions, false);
    };
    focusGroupChatEmail(userDoc) {
        let mailOptions = {
            from: process.env.ADMIN_EMAIL,
            to: 'firnaas@askpundit.com',
            subject: `doodleflow.io | ${userDoc.groupName} focusGroup has following ${userDoc.chatCount} comments`,
            text: `${userDoc.chatCount} comments has been made in focus group ${userDoc.groupName}`
        };
        this.send(mailOptions, false);
    };
    focusGroupOnScreenEmail(userDoc) {
        let mailOptions = {
            from: process.env.ADMIN_EMAIL,
            to: 'firnaas@askpundit.com',
            subject: `doodleflow.io | ${userDoc.groupName} focusGroup has following ${userDoc.commentCount} Onscreen comments`,
            text: `${userDoc.commentCount} comments has been made in focus group ${userDoc.groupName}`
        };
        this.send(mailOptions, false);
    };

    focusGroupRatingEmail(userDoc) {
        let mailOptions = {
            from: process.env.ADMIN_EMAIL,
            to: userDoc.emails,
            subject: `doodleflow.io | ${userDoc.name} and ${userDoc.userCount} others have rated the screen "${userDoc.screenName}" in ${userDoc.groupName} focusgroup`,
            text: `${userDoc.name} and ${userDoc.userCount} has rated the screen '${userDoc.screenName}' in ${userDoc.groupName} focusgroup`
        };
        this.send(mailOptions, false);
    };
    abTestingResponseEmail(userDoc) {
        let mailOptions = {
            from: process.env.ADMIN_EMAIL,
            to: userDoc.email,
            subject: `doodleflow.io | ${userDoc.userName} has put response in the A/B test ${userDoc.testingName} `,
            template: 'abtesting-invite-template',
            'h:X-Mailgun-Variables': JSON.stringify({
                userName: userDoc.userName,
                url: userDoc.link,
                testingName: userDoc.testingName
            })
        };
        this.send(mailOptions, false);
    }

    // Team invitation to Team member
    teamMemberInvite(userDoc) {
        let mailOptions = {
            from: process.env.ADMIN_EMAIL,
            to: userDoc.email,
            subject: `doodleflow.io | Team Memmber Invitation for ${userDoc.projectName}`,
            template: 'team-member-invite',
            'h:X-Mailgun-Variables': JSON.stringify({
                userName: userDoc.userName,
                url: userDoc.link,
                projectName: userDoc.projectName
            })
        };
        this.send(mailOptions, false)
    }

    //PROJECT cREATION
    projectCreation(userDoc) {
        let mailOptions = {
            from: process.env.ADMIN_EMAIL,
            to: userDoc.emails,
            subject: `doodleflow.io | ${userDoc.projectName} Project Creation`,
            template: 'project-creation',
            'h:X-Mailgun-Variables': JSON.stringify({
                userName: userDoc.userName,
                url: userDoc.link,
                projectName: userDoc.projectName,
                name: userDoc.name
            }),
        };
        this.send(mailOptions, false);
    }

    // Screen  added mail all to Team member of that project
    screenAdditionMail(userDoc) {
        let mailOptions = {
            from: process.env.ADMIN_EMAIL,
            to: userDoc.teamMembers,
            subject: `doodleflow.io | Screen Addition in ${userDoc.projectName} Project`,
            template: 'screen-addition-project',
            'h:X-Mailgun-Variables': JSON.stringify({
                "screenCount": userDoc.screenCount,
                "projectName": userDoc.projectName,
                "userName": userDoc.userName,
                "url": userDoc.link
            }),
        };
        this.send(mailOptions, false);
    }

    // Screen  added mail all to Team member of that FG
    screenAdditionMailFG(userDoc) {
        let mailOptions = {
            from: process.env.ADMIN_EMAIL,
            to: userDoc.invitedMembers,
            subject: `doodleflow.io | Screen Addition in ${userDoc.groupName} Focus Group`,
            template: 'screen-addition-fg',
            'h:X-Mailgun-Variables': JSON.stringify({
                "screenCount": userDoc.screenCount,
                "groupName": userDoc.groupName,
                "projectName": userDoc.projectId.projectName,
                "userName": userDoc.userName,
                "url": userDoc.link
            }),
        };
        this.send(mailOptions, false);
    }

    //FG creation mail to Team members
    fgCreationMail(userDoc) {
        let mailOptions = {
            from: process.env.ADMIN_EMAIL,
            to: userDoc.emails,
            subject: `doodleflow.io | Focus Group Creation in ${userDoc.projectName} Project`,
            template: 'fg-creation',
            'h:X-Mailgun-Variables': JSON.stringify({
                "userName": userDoc.userName,
                "url": userDoc.link,
                "projectName": userDoc.projectName,
                "groupName": userDoc.groupName
            }),
        };
        this.send(mailOptions, false);
    }

    //ccomment mail
    // commentChatMail(userDoc) {
    //     let mailOptions = {
    //         from: process.env.ADMIN_EMAIL,
    //         to: userDoc.teamMembers,
    //         subject: `doodleflow.io | Focus Group Creation in ${userDoc.projectName} Project`,
    //         text: `New Focus Group has been created in  ${userDoc.projectName} Project by ${userDoc.userName}`
    //     };
    //     this.send(mailOptions, false);
    // }

    invitationTeamMembers(data) {
        let mailOptions = {
            from: process.env.ADMIN_EMAIL,
            to: data.email,
            subject: `doodleflow.io | ${data.userName} has added you to team the ${data.teamName}`,
            template: 'team-addition',
            'h:X-Mailgun-Variables': JSON.stringify({
                "userName": data.userName,
                "url": data.link,
                "teamName": data.teamName
            }),
        }
        this.send(mailOptions, false);
    };


    paymentSuccessMail(userDoc) {
        let mailOptions = {
            from: process.env.ADMIN_EMAIL,
            to: userDoc.email,
            subject: userDoc.sub,
            template: 'payment-success',
            'h:X-Mailgun-Variables': JSON.stringify({
                "userName": userDoc.userName,
                "url": userDoc.link,
                "members": userDoc.members,
                "teamName": userDoc.teamName
            }),
        };
        this.send(mailOptions, false);
    };
    /**
     * 
     * Payment expiry mail 
     */

    paymentExpiry(userDoc) {
        let mailOptions = {
            from: process.env.ADMIN_EMAIL,
            to: userDoc.email,
            subject: `doodleflow.io | Team payment for ${userDoc.teamName} will expire in 7 days | Gentle Remainder`,
            text: `Hi ${userDoc.firstName},
             doodleflow team payment for your ${userDoc.teamCount} team members in ${userDoc.teamName} will expire in 7 days `
                //template: 'waitlist-template'
        };
        this.send(mailOptions, false);
    }

    usageReport(userDoc) {
        let mailOptions = {
            from: process.env.ADMIN_EMAIL,
            to: ['ajay@doodleflow.io'],
            subject: `doodleflow.io | Usage Report`,
            text: `Hi Nishyta,
                   Please find the attachement here`,
            attachment: userDoc.file
        };
        this.send(mailOptions, false);
    }

    paymentDueMail(data) {
        let mailOptions = {
            from: process.env.ADMIN_EMAIL,
            to: data.email,
            subject: data.sub,
            text: 'Payment Failed!'
                //template: 'waitlist-template'
        };
        this.send(mailOptions, false);
    }

    send(mailOptions, withTemplate = true) {
        console.log(mailOptions)
        mailgun.messages().send(mailOptions, function(error, body) {
            if (error) {
                console.log("Failed", error)
            } else {
                console.log("Mail Send successfully");
            }
        });
    }
}
mail = new mail();
module.exports = mail;