<div align="center">
  <h1>🎓 University Announcement Bot</h1>
  <p>A powerful Telegram bot for managing and broadcasting university announcements</p>

  ![Node.js](https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white)
  ![MongoDB](https://img.shields.io/badge/MongoDB-4EA94B?style=for-the-badge&logo=mongodb&logoColor=white)
  ![Telegram](https://img.shields.io/badge/Telegram-2CA5E0?style=for-the-badge&logo=telegram&logoColor=white)
</div>

## 🌟 Features

### 🌐 Multi-Language Support
- Supports English 🇬🇧, French 🇫🇷, and Arabic 🇸🇦
- Easy language switching with `/lang` command
- Personalized experience for each user

### 📢 Announcement Management
- Create rich announcements with titles and descriptions
- Support for multiple categories:
  - 📚 Academic
  - ⚽ Sports
  - 💻 Tech
  - 📅 Events
  - 📢 General
  - ⚠️ Important
- Attach images and documents to announcements
- Schedule announcements for later

### 👥 User Management
- Role-based access control (Admin/Student)
- Easy admin assignment with `/addadmin` command
- User-specific language preferences
- Automatic subscription system

### 📱 Commands

```bash
/start - Start the bot and select language
/lang - Change your preferred language
/myid - Get your Telegram ID
/announce - Create new announcement (admin only)
/getannouncements - View recent announcements
/addadmin - Add new admin (admin only)
```
## 🛠️ Technical Features
- **Real-time Updates**: Instant delivery of announcements
- **File Support**: Handle images and documents
- **MongoDB Integration**: Reliable data storage
- **Error Handling**: Robust error management
- **Input Validation**: Secure data processing
- **Modular Design**: Easy to maintain and extend

## 🎯 Use Cases
- 🏫 Universities and Schools
- 👥 Student Organizations
- 📚 Academic Departments
- 🎉 Event Management
- 📣 Club Announcements
- 📅 Schedule Updates

## 🚀 Getting Started

1. Clone the repository 

```bash
git clone https://github.com/opestro/usdb1_ann_bot.git
```
2. Install dependencies

```bash
npm install
```
3. Configure your environment variables

```bash
cp .env.example .env
```
Edit .env with your Telegram token and other settings

4. Run the bot

```bash
node start
```
## 📋 Requirements
- Node.js v18+
- MongoDB
- Telegram Bot Token

## 🔒 Security Features
- Admin authentication
- Input sanitization
- Secure file handling
- Rate limiting
- Error logging

## 🎨 Customization
The bot can be customized for various use cases:
- Corporate announcements
- Community updates
- Event management
- Course notifications
- Club activities

## 💡 Future Enhancements
- [Done] Message scheduling
- [ ] Poll creation
- [ ] Interactive replies
- [ ] Analytics dashboard
- [ ] Custom categories
- [ ] Bulk messaging

## 👨‍💻 Developed By
**Mehdi Harzallah**  
Computer Science Club (CSC)  
[GitHub](https://github.com/opestro) | [LinkedIn](https://linkedin.com/in/mehdiharzallah)

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 🐛 Bug Reports

Found a bug? Please open an issue with:
- Expected behavior
- Actual behavior
- Steps to reproduce
- Bot version

## 📞 Support

Need help? Contact us:
- Facebook: [CSCClub Facebook Page](https://www.facebook.com/cscclub/)
- Email: cscclub@gmail.com or mahdiharzallah21@gmail.com
- GitHub Issues
<!-- 
## 📄 License
This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details. -->

---

<div align="center">
  <p>Made with ❤️ at CSC Club</p>
  <p>is OpenSource project by Mehdi Harzallah using AI</p>
</div>