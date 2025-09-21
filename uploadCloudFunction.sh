#!/bin/bash

# 微信云开发部署脚本
# 使用说明: ./uploadCloudFunction.sh <微信开发者工具路径> <环境ID> <项目路径>

# 设置环境变量默认值
installPath=$1
envId=$2
projectPath=$3

# 检查参数是否完整
if [ -z "$installPath" ] || [ -z "$envId" ] || [ -z "$projectPath" ]; then
  echo "用法: ./uploadCloudFunction.sh <微信开发者工具路径> <环境ID> <项目路径>"
  echo "示例: ./uploadCloudFunction.sh '/Applications/wechatwebdevtools.app/Contents/MacOS/cli' 'your-env-id' '/path/to/project'"
  exit 1
fi

# 打印部署信息
 echo "开始部署云函数和公共模块..."
 echo "微信开发者工具路径: $installPath"
 echo "环境ID: $envId"
 echo "项目路径: $projectPath"

# 部署utils目录作为公共模块 (先部署依赖模块)
echo "正在部署utils公共模块..."
${installPath} cloud functions deploy --e ${envId} --n utils --r --project ${projectPath}
if [ $? -ne 0 ]; then
  echo "utils模块部署失败！"
  exit 1
fi

# 部署quickstartFunctions云函数
echo "正在部署quickstartFunctions云函数..."
${installPath} cloud functions deploy --e ${envId} --n quickstartFunctions --r --project ${projectPath}
if [ $? -ne 0 ]; then
  echo "quickstartFunctions云函数部署失败！"
  exit 1
fi

# 部署seatArrangementFunctions云函数
echo "正在部署seatArrangementFunctions云函数..."
${installPath} cloud functions deploy --e ${envId} --n seatArrangementFunctions --r --project ${projectPath}
if [ $? -ne 0 ]; then
  echo "seatArrangementFunctions云函数部署失败！"
  exit 1
fi

echo "所有云函数和公共模块部署成功！"