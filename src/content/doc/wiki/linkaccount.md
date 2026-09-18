---
title: "将Bedrock账户绑定至Java版账户"
description: "linkaccount"
---
<small id="old_menu"><a href="/">首页</a> | <a href="/doc/">文档</a></small><small><a href="/doc">←返回</a> |
 创建：2025-02-22 | 最后更新：2026-07-14</small><br>

## 前言

Floodgate允许您直接使用基岩版连接到服务器，不过您的昵称采用Xbox档案名且拥有前缀；而*Linkaccount*可以帮助您以Java版玩家档案进入服务器。<br>
栈流Streack使用自建的绑定服务。<br>

> [i] 继续操作前，您需要一个Java正版账户和一个基岩版账户。

## 绑定
使用要绑定的Java版和基岩版同时进入服务器，基岩版侧输入：

```text
/linkaccount
```

之后，基岩版侧会收到详细的绑定教程，在Java版侧完成对应操作即可绑定。<br>
绑定后，基岩版或Java版连接服务器都将以Java版身份登录，且基岩版定向优化仍能自动生效。<br>
同时，绑定后基岩版数据会**被冻结而无法访问**，直到你进行[解绑](#解绑)。

## 解绑
使用任意客户端进入服务器，并执行以下命令：

```text
/unlinkaccount
```

解绑后Java版和基岩版将被视作两个不同账号：解绑前数据由Java版继承，而绑定前的基岩版数据由基岩版继承。