WITH ad_dropzone AS (SELECT DISTINCT REPLACE(filename, '"','') As ad_id_creative, channel As channel_creative FROM "etete_schedule"."amc_ad_dropzone"),

underlying_ads AS (
WITH all_underlyingads AS (WITH currentFile As (SELECT MAX(DISTINCT CONCAT(partition_0,partition_1,partition_2)) As partition1 FROM "etete_underlyingads"."underlyingads"),
       allFiles As (SELECT *, CONCAT(partition_0,partition_1,partition_2) As partition2 FROM "etete_underlyingads"."underlyingads")

SELECT *, CONCAT(houseid,'_',isci,'_',networks) As id_concat
FROM allFiles JOIN currentFile
ON partition1 = partition2),

published_ads AS (SELECT * FROM all_underlyingads WHERE status = 'PUBLISHED'),

unpublished_ads AS (SELECT * FROM all_underlyingads WHERE status <> 'PUBLISHED' AND id_concat NOT IN (SELECT id_concat FROM published_ads))

SELECT * FROM published_ads
UNION
SELECT * FROM unpublished_ads
),

includedFiles AS (
  WITH all_schedule_s3_logs AS (
  SELECT DISTINCT channel As log_channel,
  substr(s3, position('/' IN s3)+1) As s3join,
  starttime As log_start,
  endtime As log_end,
  CONCAT(channel,'_',earliestscheduledate,'_',latestscheduledate) As start_end_string,
  stage

  FROM "blocked"."schedule_import_logs"
  WHERE stage = 'Complete'),

all_log_files AS (
  SELECT start_end_string, MAX(log_start) As max_updated FROM all_schedule_s3_logs

  GROUP BY 1)

SELECT s3join As includedFile FROM all_schedule_s3_logs
INNER JOIN all_log_files
ON all_schedule_s3_logs.start_end_string = all_log_files.start_end_string
AND
all_schedule_s3_logs.log_start = all_log_files.max_updated),

schedule_data AS (
  SELECT advertiser As advertiser_sch,
  house_id As houseid_sch,
  break_code As breakcode,
  prgsvcid_,
  created,
  channel,
  title,
  record_id As recordid,
  duration,
  industry_id As industryid,
  coverable,
  checksum,
  logscheduleid,
  start_time As starttime,
  end_time As endtime,
  brand As brand_sch,
  updated,
  substr(s3string, position('/' IN s3string)+1) As s3join
  FROM "etete_schedule"."ad_tech_bapi_schedules_processed_etete"
  WHERE house_id='XC71025')

SELECT * FROM schedule_data

LEFT JOIN "blocked"."tableau_users" ON "blocked"."tableau_users".channel_users = schedule_data.channel
LEFT JOIN ad_dropzone ON schedule_data.industryid = ad_dropzone.ad_id_creative AND schedule_data.channel = ad_dropzone.channel_creative
LEFT JOIN underlying_ads ON schedule_data.houseid_sch = underlying_ads.houseid AND schedule_data.industryid = underlying_ads.isci
AND underlying_ads.networks LIKE CONCAT('%',schedule_data.prgsvcid_,'%')
INNER JOIN includedFiles ON includedFiles.includedFile = schedule_data.s3join
