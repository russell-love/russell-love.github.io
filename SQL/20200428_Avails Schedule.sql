--Get the filenames for all the unique ads found in the ad dropzone
WITH ad_dropzone AS (SELECT DISTINCT REPLACE(filename, '"','') As ad_id_creative, channel As channel_creative FROM etete_schedule.amc_ad_dropzone),

--Underlying ad construct
underlying_ads AS (
--
--Query is phased to ensure only the correct data is included
WITH all_underlyingads AS (
-- Get the datetime (constructed from the partitions) of the most recent file
WITH currentFile As (SELECT MAX(DISTINCT CONCAT(partition_0,partition_1,partition_2)) As partition1 FROM etete_underlyingads.underlyingads),
--Get the contents of all the files, as well as the datetime
allFiles As (SELECT *, CONCAT(partition_0,partition_1,partition_2) As partition2 FROM etete_underlyingads.underlyingads)

--Create a unique identifier for an underlying ad, using the house id, isci and networks
--Select all the underlying ads found in the most recent partition
SELECT *, CONCAT(houseid,"_",isci,"_",networks) As id_concat
FROM allFiles JOIN currentFile
ON partition1 = partition2),

--The above method returns duplications if ads exist in both a published and unpublished state...
--Select all the published ads
published_ads AS (SELECT * FROM all_underlyingads WHERE status = "PUBLISHED"),
--Select all the unpublished ads provided the unique ID does not exist in the published ads
unpublished_ads AS (SELECT * FROM all_underlyingads WHERE status <> "PUBLISHED" AND id_concat NOT IN (SELECT id_concat FROM published_ads))

--Union the unique published and unpublished ads
SELECT * FROM published_ads
UNION
SELECT * FROM unpublished_ads
),

includedFiles AS (
--Since it's possible for their to be multiple files dropped for the same period of time, we need to identify the most recent one
--and disregard the data from the other

--Select the distinct records from the ingest audit table where the file was ingested (stage = Complete)
--An identifier for each row is created using the channel name and the contents of the file (earliest/latest schedule date)
WITH all_schedule_s3_logs AS (
SELECT DISTINCT channel As log_channel,
substr(s3, position("/" IN s3)+1) As s3join, starttime As log_start, endtime As log_end,
CONCAT(channel,"_",earliestscheduledate,"_",latestscheduledate) As start_end_string, stage

FROM blocked.schedule_import_logs
WHERE stage = 'Complete'),

--Select all files in the data by their identifier - and the most recently ingested file (the max of the log_start)
all_log_files AS (
SELECT start_end_string, MAX(log_start) As max_updated FROM all_schedule_s3_logs
GROUP BY 1)

--Select the filename of the logs, inner joined to only the most recently ingested file info
SELECT s3join As includedFile FROM all_schedule_s3_logs
INNER JOIN all_log_files
ON all_schedule_s3_logs.start_end_string = all_log_files.start_end_string
AND
all_schedule_s3_logs.log_start = all_log_files.max_updated),

--Get the schedule data from the s3 drop location, add in an identifying string for the filename excluding the 1st partition
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
  FROM etete_schedule.ad_tech_bapi_schedules_processed_etete)

--Final structure
--Select all the schedule data
SELECT * FROM schedule_data
--Join the user data table
LEFT JOIN blocked.tableau_users ON blocked.tableau_users.channel_users = schedule_data.channel
--Join the ad dropzone data table
LEFT JOIN ad_dropzone ON schedule_data.industryid = ad_dropzone.ad_id_creative AND schedule_data.channel = ad_dropzone.channel_creative
--Join the underlying ads, as the underlying ads data stores the channels in an array field (networks)- the join is on a LIKE condition
LEFT JOIN underlying_ads ON schedule_data.houseid_sch = underlying_ads.houseid AND schedule_data.industryid = underlying_ads.isci
AND underlying_ads.networks LIKE CONCAT('%',schedule_data.prgsvcid,'%')
--In order to only include data from files which should be included - an inner join is used to exclude any unwanted schedule data
INNER JOIN includedFiles ON includedFiles.includedFile = schedule_data.s3join