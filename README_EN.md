English | [中文](./README.md)

<p>An AI-powered diagram platform lets you describe charts in natural language and interact with AI for easy creation. It supports Mermaid, Excalidraw, and Draw.io engines. Users can privately deploy with Docker, store and manage diagram files, and choose between local or cloud use.

<p>AI驱动的图表创作平台，与AI对话，轻松使用Mermaid、Excalidraw和Draw.io绘图，支持docker私有部署、绘图文件存储和管理、本地和云端两种使用模式。


<div align=center>

# AI Draw <img src="https://github.com/user-attachments/assets/afbc4c80-53ee-4fdd-93cd-b0710408eb8c" width = "30" height = "30" div  /> Visualize Your Ideas


Chat with AI, bring your ideas to life

[![Image](https://github.com/user-attachments/assets/33a8fde6-2d2e-4c50-9416-7bae701451a4)](http://100qie.cn:3000)

</div>

<p>AI Draw is a smart diagramming tool that generates flowcharts, timelines, architecture diagrams, and more using natural language commands, eliminating the need for complex drag-and-drop operations and making ideas visible instantly. It supports Mermaid, Excalidraw, and Draw.io and allows for private deployment via Docker, as well as the management of drawing files and groups.

<p>Developed from next-ai-drawio and ai-draw-next, it includes enhanced features such as file management, group organization, both local and cloud-based access, and dynamic drawing effects, while also improving the user experience through various adjustments.

## Screenshot

![Index](https://github.com/user-attachments/assets/94511f78-e4bb-4d96-af8b-5593e2beb69a)

![edit](https://github.com/user-attachments/assets/e2a88a96-0e47-4135-9594-6bf0a923e173)

![file manage](https://github.com/user-attachments/assets/a200fe52-884b-405b-94f6-60d0f5d697ab)

![Statistics](https://github.com/user-attachments/assets/fa455516-2805-4258-a8bf-de4f4ff479a7)


## Private deployment- Docker Compose （Recommendation）

**1. Deploy and launch a project using Docker**

```bash
version: '3.8'

services:
  ai-draw:
    build: .
    image: ghcr.io/stone-yu/ai-draw:latest
    container_name: ai-draw
    restart: unless-stopped
    ports:
      - "3000:3000"
    volumes:
      # Map local data directory to container data directory
      # On NAS, change ./data to your actual path, e.g., /volume1/docker/aidraw/data
      - ./data/aidraw:/app/data
    environment:
      - PORT=3000
      - DATA_DIR=/app/data
      - DEBUG=false
```

**2.Access the system：** Access http://<NAS_IP>:3000 to use. The data will be saved in the /app/data folder under the project directory；

**3.Admin login：** Log in with the default admin account: admin/admin123. Change the password promptly after logging in；

**4.Set up the global LLM model：** Go to System Settings > Global LLM Model on the left, and fill in the required information；

## Local development

**1.Launch the project**

```bash
git clone https://github.com/stone-yu/ai-draw
cd ai-draw
pnpm install

# Start both the frontend and backend
pnpm run dev
# Access http://localhost:8787

# Or start them separately：
pnpm run dev:frontend   #  Vite (http://localhost:5173)
pnpm run dev:backend    #  Wrangler Pages (http://localhost:8787)
```
**2.Visit the frontend address on the console; data will be saved in the /app/data folder under the project directory；**

**3.Admin login：** Log in with the default admin account: admin/admin123. Change the password promptly after logging in；

**4.Set up the global LLM model：** Go to System Settings > Global LLM Model on the left, and fill in the required information；


## Technology Stack

- **Frontend**：React 19 + Vite + TypeScript + Tailwind CSS
- **State Management**：Zustand
- **Local Storage**：Dexie.js (IndexedDB)
- **Icon Library**：Lucide React

## Supported AI Services

| 服务商 | AI_PROVIDER | AI_BASE_URL | 推荐模型 |
|--------|-------------|-------------|----------|
| OpenAI | openai | https://api.openai.com/v1 | gpt-5 |
| Anthropic | anthropic | https://api.anthropic.com/v1 | claude-sonnet-4-5 |
| 其他兼容服务 | openai | 自定义 URL | - |


## Feedback
Your feedback is very important to us. If you encounter any issues while using our service or have any feature suggestions, please feel free to contact us through the following methods.

- **Github Issues**：https://github.com/stone-yu/ai-draw/issues

## 📈 Star History

[![Star History Chart](https://api.star-history.com/svg?repos=stone-yu/ai-draw&type=Date&t=new)](https://www.star-history.com/#stone-yu/ai-draw&type=date&legend=top-left)


## Open-Source License

MIT
