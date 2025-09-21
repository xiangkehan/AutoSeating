# 部署quickstartFunctions云函数
${installPath} cloud functions deploy --e ${envId} --n quickstartFunctions --r --project ${projectPath}

# 部署seatArrangementFunctions云函数
${installPath} cloud functions deploy --e ${envId} --n seatArrangementFunctions --r --project ${projectPath}

# 部署utils目录作为公共模块
${installPath} cloud functions deploy --e ${envId} --n utils --r --project ${projectPath}