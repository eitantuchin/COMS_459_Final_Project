const AWS = require('aws-sdk');

async function runVpcChecks(credentials) {
    const ec2 = new AWS.EC2({ ...credentials, region: 'us-east-1' });
    const regionResponse = await ec2.describeRegions().promise();
    const regions = regionResponse.Regions.map(region => region.RegionName);
  
    const vpcPromises = regions.map(region => {
      const regionalEc2 = new AWS.EC2({ ...credentials, region });
      return Promise.all([
        regionalEc2.describeVpcs().promise(),
        regionalEc2.describeSubnets().promise(),
        regionalEc2.describeRouteTables().promise(),
        regionalEc2.describeNetworkAcls().promise(),
        regionalEc2.describeSecurityGroups().promise(),
        regionalEc2.describeInternetGateways().promise(),
      ]).then(([vpcs, subnets, routeTables, nacls, securityGroups, igws]) => ({
        region,
        vpcs: vpcs.Vpcs,
        subnets: subnets.Subnets,
        routeTables: routeTables.RouteTables,
        nacls: nacls.NetworkAcls,
        securityGroups: securityGroups.SecurityGroups,
        igws: igws.InternetGateways,
      }));
    });
  
    const vpcResponses = await Promise.all(vpcPromises);
    const allVpcs = [];
    const allSubnets = [];
    const allRouteTables = [];
    const allNacls = [];
    const allSecurityGroups = [];
    const allIgws = [];
  
    vpcResponses.forEach(response => {
      allVpcs.push(...response.vpcs.map(vpc => ({ ...vpc, Region: response.region })));
      allSubnets.push(...response.subnets.map(subnet => ({ ...subnet, Region: response.region })));
      allRouteTables.push(...response.routeTables.map(rt => ({ ...rt, Region: response.region })));
      allNacls.push(...response.nacls.map(nacl => ({ ...nacl, Region: response.region })));
      allSecurityGroups.push(...response.securityGroups.map(sg => ({ ...sg, Region: response.region })));
      allIgws.push(...response.igws.map(igw => ({ ...igw, Region: response.region })));
    });
  
    const checks = {
      totalChecks: 0,
      totalPassed: 0,
      details: [],
    };
  
    // Track assets and risks per region
    const regionStats = {};
    regions.forEach(region => {
      regionStats[region] = {
        totalAssets: 0,
        assetsAtRisk: new Set(),
      };
    });
  
    const assetsAtRiskSet = new Set();
  
    const addCheck = (name, passed, message, assetIds = []) => {
      checks.totalChecks++;
      if (passed) checks.totalPassed++;
      checks.details.push({ name, passed, message });
      if (!passed) {
        assetIds.forEach(id => {
          assetsAtRiskSet.add(id);
          // Find the region for this asset and add to region-specific set
          const asset = allVpcs.find(v => v.VpcId === id) ||
                        allSubnets.find(s => s.SubnetId === id) ||
                        allSecurityGroups.find(sg => sg.GroupId === id) ||
                        allNacls.find(n => n.NetworkAclId === id) ||
                        allRouteTables.find(rt => rt.RouteTableId === id) ||
                        allIgws.find(igw => igw.InternetGatewayId === id);
          if (asset && asset.Region) {
            regionStats[asset.Region].assetsAtRisk.add(id);
          }
        });
      }
    };
  
    const vpcsExist = allVpcs.length > 0;
    addCheck(
      'VPCs Exist',
      vpcsExist,
      vpcsExist ? 'VPCs are present.' : 'No VPCs found.'
    );
  
    if (!vpcsExist) {
      regions.forEach(region => {
        regionStats[region].totalAssets = allVpcs.filter(v => v.Region === region).length +
                                          allSubnets.filter(s => s.Region === region).length +
                                          allSecurityGroups.filter(sg => sg.Region === region).length;
      });
      return { 
        ...checks, 
        totalAssets: allVpcs.length + allSubnets.length + allSecurityGroups.length, 
        assetsAtRisk: assetsAtRiskSet.size,
        regionStats: Object.fromEntries(
          Object.entries(regionStats).map(([region, stats]) => [region, {
            totalAssets: stats.totalAssets,
            assetsAtRisk: stats.assetsAtRisk.size
          }])
        )
      };
    }
  
    const flowLogsPromises = regions.map(region => 
      new AWS.EC2({ ...credentials, region }).describeFlowLogs().promise()
    );
    const flowLogsResponses = await Promise.all(flowLogsPromises);
    const allFlowLogs = flowLogsResponses.flatMap(response => response.FlowLogs);
    const vpcsNoFlowLogs = allVpcs.filter(vpc => !allFlowLogs.some(log => log.ResourceId === vpc.VpcId));
    addCheck(
      'VPC Flow Logs Enabled',
      vpcsNoFlowLogs.length === 0,
      vpcsNoFlowLogs.length === 0
        ? 'All VPCs have flow logs enabled.'
        : `Some VPCs (${vpcsNoFlowLogs.map(v => `${v.VpcId} (${v.Region})`).join(', ')}) lack flow logs.`,
      vpcsNoFlowLogs.map(v => v.VpcId)
    );
  
    const subnetsNoRoute = allSubnets.filter(s => 
      !allRouteTables.some(rt => rt.Associations.some(a => a.SubnetId === s.SubnetId))
    );
    addCheck(
      'Subnets Routed',
      subnetsNoRoute.length === 0,
      subnetsNoRoute.length === 0
        ? 'All subnets are associated with a route table.'
        : `Some subnets (${subnetsNoRoute.map(s => `${s.SubnetId} (${s.Region})`).join(', ')}) lack route table associations.`,
      subnetsNoRoute.map(s => s.SubnetId)
    );
  
    const publicSubnets = allSubnets.filter(s => 
      allRouteTables.some(rt => 
        rt.Associations.some(a => a.SubnetId === s.SubnetId) && 
        rt.Routes.some(r => r.GatewayId?.startsWith('igw-'))
      )
    );
    addCheck(
      'No Public Subnets',
      publicSubnets.length === 0,
      publicSubnets.length === 0
        ? 'No subnets are public.'
        : `Some subnets (${publicSubnets.map(s => `${s.SubnetId} (${s.Region})`).join(', ')}) are public.`,
      publicSubnets.map(s => s.SubnetId)
    );
  
    const vpcsSingleAz = allVpcs.filter(v => {
      const vpcSubnets = allSubnets.filter(s => s.VpcId === v.VpcId);
      const azs = new Set(vpcSubnets.map(s => s.AvailabilityZone));
      return azs.size < 2;
    });
    addCheck(
      'Multiple AZ Subnets',
      vpcsSingleAz.length === 0,
      vpcsSingleAz.length === 0
        ? 'All VPCs have subnets in multiple AZs.'
        : `Some VPCs (${vpcsSingleAz.map(v => `${v.VpcId} (${v.Region})`).join(', ')}) lack subnets in multiple AZs.`,
      vpcsSingleAz.map(v => v.VpcId)
    );
  
    const vpcsNoNacl = allVpcs.filter(v => 
      !allNacls.some(n => n.Associations.some(a => a.SubnetId && allSubnets.some(s => s.VpcId === v.VpcId && s.SubnetId === a.SubnetId)))
    );
    addCheck(
      'Network ACLs Present',
      vpcsNoNacl.length === 0,
      vpcsNoNacl.length === 0
        ? 'All VPCs have Network ACLs.'
        : `Some VPCs (${vpcsNoNacl.map(v => `${v.VpcId} (${v.Region})`).join(', ')}) lack Network ACLs.`,
      vpcsNoNacl.map(v => v.VpcId)
    );
  
    const naclsNoDenyInbound = allNacls.filter(n => 
      !n.Entries.some(e => e.RuleNumber === 32767 && e.Egress === false && e.RuleAction === 'deny')
    );
    addCheck(
      'NACL Deny Inbound Default',
      naclsNoDenyInbound.length === 0,
      naclsNoDenyInbound.length === 0
        ? 'All NACLs deny inbound traffic by default.'
        : `Some NACLs (${naclsNoDenyInbound.map(n => `${n.NetworkAclId} (${n.Region})`).join(', ')}) do not deny inbound by default.`,
      naclsNoDenyInbound.map(n => n.NetworkAclId)
    );
  
    const sgsPermissive = allSecurityGroups.filter(sg => 
      sg.IpPermissions.some(p => 
        p.IpRanges.some(ip => ip.CidrIp === '0.0.0.0/0') || 
        p.Ipv6Ranges.some(ip => ip.CidrIpv6 === '::/0')
      )
    );
    addCheck(
      'No Overly Permissive SG Rules',
      sgsPermissive.length === 0,
      sgsPermissive.length === 0
        ? 'No security groups have overly permissive rules.'
        : `Some security groups (${sgsPermissive.map(sg => `${sg.GroupId} (${sg.Region})`).join(', ')}) allow traffic from 0.0.0.0/0.`,
      sgsPermissive.map(sg => sg.GroupId)
    );
  
    const vpcsNoDnsSupport = allVpcs.filter(v => !v.EnableDnsSupport);
    addCheck(
      'DNS Support Enabled',
      vpcsNoDnsSupport.length === 0,
      vpcsNoDnsSupport.length === 0
        ? 'All VPCs have DNS support enabled.'
        : `Some VPCs (${vpcsNoDnsSupport.map(v => `${v.VpcId} (${v.Region})`).join(', ')}) lack DNS support.`,
      vpcsNoDnsSupport.map(v => v.VpcId)
    );
  
    const vpcsNoDnsHostnames = allVpcs.filter(v => !v.EnableDnsHostnames);
    addCheck(
      'DNS Hostnames Enabled',
      vpcsNoDnsHostnames.length === 0,
      vpcsNoDnsHostnames.length === 0
        ? 'All VPCs have DNS hostnames enabled.'
        : `Some VPCs (${vpcsNoDnsHostnames.map(v => `${v.VpcId} (${v.Region})`).join(', ')}) lack DNS hostnames.`,
      vpcsNoDnsHostnames.map(v => v.VpcId)
    );
  
    const rtsUntrusted = allRouteTables.filter(rt => 
      rt.Routes.some(r => 
        r.DestinationCidrBlock && 
        ['0.0.0.0/0', '::/0'].includes(r.DestinationCidrBlock) && 
        !r.GatewayId?.startsWith('igw-')
      )
    );
    addCheck(
      'No Untrusted Routes',
      rtsUntrusted.length === 0,
      rtsUntrusted.length === 0
        ? 'No route tables have untrusted destinations.'
        : `Some route tables (${rtsUntrusted.map(rt => `${rt.RouteTableId} (${rt.Region})`).join(', ')}) have untrusted routes.`,
      rtsUntrusted.map(rt => rt.RouteTableId)
    );
  
    const vpcsNoTags = allVpcs.filter(v => !v.Tags?.length);
    addCheck(
      'VPC Tagging',
      vpcsNoTags.length === 0,
      vpcsNoTags.length === 0
        ? 'All VPCs are tagged.'
        : `Some VPCs (${vpcsNoTags.map(v => `${v.VpcId} (${v.Region})`).join(', ')}) lack tags.`,
      vpcsNoTags.map(v => v.VpcId)
    );
  
    const igwsUnattached = allIgws.filter(igw => !igw.Attachments?.length);
    addCheck(
      'IGWs Attached',
      igwsUnattached.length === 0,
      igwsUnattached.length === 0
        ? 'All Internet Gateways are attached to a VPC.'
        : `Some Internet Gateways (${igwsUnattached.map(igw => `${igw.InternetGatewayId} (${igw.Region})`).join(', ')}) are unattached.`,
      igwsUnattached.map(igw => igw.InternetGatewayId)
    );
  
    const subnetsLowIps = allSubnets.filter(s => s.AvailableIpAddressCount <= 10);
    addCheck(
      'Sufficient Subnet IPs',
      subnetsLowIps.length === 0,
      subnetsLowIps.length === 0
        ? 'All subnets have sufficient IP addresses.'
        : `Some subnets (${subnetsLowIps.map(s => `${s.SubnetId} (${s.Region})`).join(', ')}) have fewer than 10 available IPs.`,
      subnetsLowIps.map(s => s.SubnetId)
    );
  
    const sgsNoDesc = allSecurityGroups.filter(sg => !sg.Description || sg.Description.trim() === '');
    addCheck(
      'SG Descriptions',
      sgsNoDesc.length === 0,
      sgsNoDesc.length === 0
        ? 'All security groups have descriptions.'
        : `Some security groups (${sgsNoDesc.map(sg => `${sg.GroupId} (${sg.Region})`).join(', ')}) lack descriptions.`,
      sgsNoDesc.map(sg => sg.GroupId)
    );
  
    // Calculate total assets per region
    regions.forEach(region => {
      regionStats[region].totalAssets = allVpcs.filter(v => v.Region === region).length +
                                        allSubnets.filter(s => s.Region === region).length +
                                        allSecurityGroups.filter(sg => sg.Region === region).length;
    });
  
    return {
      ...checks,
      totalAssets: allVpcs.length + allSubnets.length + allSecurityGroups.length,
      assetsAtRisk: assetsAtRiskSet.size,
      regionStats: Object.fromEntries(
        Object.entries(regionStats).map(([region, stats]) => [region, {
          totalAssets: stats.totalAssets,
          assetsAtRisk: stats.assetsAtRisk.size
        }])
      )
    };
  }
  
  module.exports = { runVpcChecks };